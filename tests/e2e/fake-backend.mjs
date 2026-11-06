// Simula o subconjunto de Supabase (auth, rest, rpc, storage) e AbacatePay usado pelo app.
// O SQL é o das migrations reais, rodando em PGlite com roles e RLS de verdade.
import crypto from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import webpush from "web-push";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const PORT = Number(process.env.E2E_BACKEND_PORT ?? 54399);
const APP_URL = process.env.E2E_APP_URL ?? "http://localhost:3100";
const WEBHOOK_SECRET = "segredo-do-webhook";
const WEBHOOK_DELAY_MS = 3000;

const abacateSource = readFileSync(`${projectRoot}/lib/abacatepay.ts`, "utf8");
const ABACATE_PUBLIC_KEY = abacateSource.match(/"(t9dX[^"]+)"/)[1];

// ---- JWT
const SECRET = "fake-jwt-secret";
const b64 = (value) => Buffer.from(value).toString("base64url");
function sign(payload) {
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${signature}`;
}
function verify(token) {
  if (!token) return null;
  const [head, body, signature] = token.split(".");
  if (!signature) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  if (signature !== expected) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}

const FAR_FUTURE = 4102444800;
const ANON_KEY = sign({ role: "anon", iss: "fake", exp: FAR_FUTURE });
const SERVICE_KEY = sign({ role: "service_role", iss: "fake", exp: FAR_FUTURE });

const vapid = webpush.generateVAPIDKeys();
const pushLog = [];

const APP_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${PORT}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  NEXT_PUBLIC_SITE_URL: APP_URL,
  ABACATEPAY_API_URL: `http://localhost:${PORT}/v2`,
  ABACATEPAY_API_KEY: "chave-falsa",
  ABACATEPAY_PRO_PRODUCT_ID: "prod_fake",
  ABACATEPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: "mailto:teste@exemplo.com",
};

// ---- banco
const db = new PGlite();

async function setupDatabase() {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;

    create schema storage;
    create table storage.buckets (
      id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select (string_to_array(name, '/'))[1:cardinality(string_to_array(name, '/')) - 1]
    $$;
    grant usage on schema storage to anon, authenticated, service_role;
    grant all on storage.objects to authenticated;
    grant execute on function storage.foldername(text) to authenticated;

    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  const migrations = path.join(projectRoot, "supabase/migrations");
  for (const file of readdirSync(migrations).sort()) {
    await db.exec(readFileSync(path.join(migrations, file), "utf8"));
  }
}

// Fila própria: o PGlite tem uma conexão só.
async function runAs(claims, sql) {
  const role = claims?.role ?? "anon";
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims ?? {})]);
    await tx.exec(`set local role ${role}`);
    return tx.query(sql);
  });
}

const ident = (name) => `"${String(name).replace(/"/g, '""')}"`;
function lit(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length ? `ARRAY[${value.map(lit).join(",")}]` : "'{}'";
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

const SCALAR_FUNCTIONS = [
  "record_swipe",
  "is_member",
  "is_pro",
  "post_story",
  "view_story",
  "toggle_story_like",
  "record_profile_view",
  "send_message",
  "mark_chat_read",
  "unread_messages",
  "toggle_event_attendance",
];

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
const OPERATORS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };

function whereClause(params) {
  const clauses = [];
  for (const [key, raw] of params) {
    if (RESERVED.has(key)) continue;
    const negated = raw.startsWith("not.");
    const value = negated ? raw.slice(4) : raw;
    const dot = value.indexOf(".");
    const op = value.slice(0, dot);
    const argument = value.slice(dot + 1);

    let clause;
    if (OPERATORS[op]) clause = `${ident(key)} ${OPERATORS[op]} ${lit(argument)}`;
    else if (op === "is") clause = `${ident(key)} is ${argument}`;
    else if (op === "in") {
      const items = argument.slice(1, -1).split(",").map((item) => item.replace(/^"|"$/g, ""));
      clause = `${ident(key)} in (${items.map(lit).join(",")})`;
    } else throw new Error(`Operador não simulado: ${op}`);

    clauses.push(negated ? `not (${clause})` : clause);
  }
  return clauses.length ? `where ${clauses.join(" and ")}` : "";
}

function orderClause(params) {
  const order = params.get("order");
  if (!order) return "";
  const parts = order.split(",").map((part) => {
    const [column, direction] = part.split(".");
    return `${ident(column)} ${direction === "desc" ? "desc" : "asc"}`;
  });
  return `order by ${parts.join(",")}`;
}

function selectList(params) {
  const select = params.get("select");
  if (!select || select === "*") return "*";
  return select.split(",").map((column) => ident(column.trim())).join(",");
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

function sendRows(req, res, rows, status = 200) {
  const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  if (wantsObject) {
    if (rows.length !== 1) {
      sendJson(res, 406, {
        code: "PGRST116",
        message: "JSON object requested, multiple (or no) rows returned",
        details: `The result contains ${rows.length} rows`,
        hint: null,
      });
      return;
    }
    sendJson(res, status, rows[0]);
    return;
  }
  sendJson(res, status, rows);
}

function pgError(res, error) {
  const status = { 23505: 409, 23514: 400, 22023: 400, 42501: 403, "22P02": 400 }[error.code] ?? 400;
  sendJson(res, status, {
    code: error.code ?? "XX000",
    message: error.message,
    details: error.detail ?? null,
    hint: null,
  });
}

function claimsOf(req) {
  const header = req.headers.authorization ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  return verify(token) ?? verify(req.headers.apikey) ?? { role: "anon" };
}

async function handleRest(req, res, url, rawBody) {
  const table = url.pathname.replace("/rest/v1/", "");
  const claims = claimsOf(req);
  const params = url.searchParams;
  const prefer = req.headers.prefer ?? "";

  if (table.startsWith("rpc/")) {
    const fn = table.slice(4);
    const body = rawBody.length ? JSON.parse(rawBody.toString()) : {};
    const args = Object.entries(body).map(([key, value]) => `${ident(key)} => ${lit(value)}`).join(",");
    const scalar = SCALAR_FUNCTIONS.includes(fn);
    const sql = scalar
      ? `select public.${ident(fn)}(${args}) as value`
      : `select coalesce(json_agg(t), '[]'::json) as rows from public.${ident(fn)}(${args}) t`;
    const result = await runAs(claims, sql);
    if (scalar) sendJson(res, 200, result.rows[0].value);
    else sendRows(req, res, result.rows[0].rows);
    return;
  }

  const target = `public.${ident(table)}`;

  if (req.method === "GET" || req.method === "HEAD") {
    const where = whereClause(params);
    const limit = params.get("limit") ? `limit ${Number(params.get("limit"))}` : "";
    const sql = `select coalesce(json_agg(t), '[]'::json) as rows from (
      select ${selectList(params)} from ${target} ${where} ${orderClause(params)} ${limit}
    ) t`;
    const result = await runAs(claims, sql);
    const rows = result.rows[0].rows;
    const headers = {};
    if (prefer.includes("count=exact")) {
      const count = await runAs(claims, `select count(*)::int as n from ${target} ${where}`);
      headers["Content-Range"] = `0-${Math.max(rows.length - 1, 0)}/${count.rows[0].n}`;
    }
    if (req.method === "HEAD") {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    res.setHeader("Content-Range", headers["Content-Range"] ?? `0-${rows.length - 1}/*`);
    sendRows(req, res, rows);
    return;
  }

  const wantsRows = prefer.includes("return=representation");
  const select = selectList(params);

  if (req.method === "POST") {
    const body = JSON.parse(rawBody.toString());
    const rows = Array.isArray(body) ? body : [body];
    const columns = [...new Set(rows.flatMap(Object.keys))];
    const values = rows
      .map((row) => `(${columns.map((column) => (column in row ? lit(row[column]) : "DEFAULT")).join(",")})`)
      .join(",");
    let conflict = "";
    if (prefer.includes("resolution=ignore-duplicates")) conflict = "on conflict do nothing";
    if (prefer.includes("resolution=merge-duplicates")) {
      const keys = (params.get("on_conflict") ?? columns[0]).split(",").map(ident).join(",");
      const updates = columns.map((column) => `${ident(column)} = excluded.${ident(column)}`).join(",");
      conflict = `on conflict (${keys}) do update set ${updates}`;
    }
    const sql = `with changed as (
      insert into ${target} (${columns.map(ident).join(",")}) values ${values} ${conflict} returning *
    ) select coalesce(json_agg(t), '[]'::json) as rows from (select ${select} from changed) t`;
    const result = await runAs(claims, sql);
    if (wantsRows) sendRows(req, res, result.rows[0].rows, 201);
    else sendJson(res, 201);
    return;
  }

  if (req.method === "PATCH") {
    const body = JSON.parse(rawBody.toString());
    // A lista de gostos é jsonb: como array comum, viraria um array do Postgres.
    const toSql = (key, value) => (key === "hobbies" ? lit({ toJSON: () => value }) : lit(value));
    const assignments = Object.entries(body).map(([key, value]) => `${ident(key)} = ${toSql(key, value)}`).join(",");
    const sql = `with changed as (
      update ${target} set ${assignments} ${whereClause(params)} returning *
    ) select coalesce(json_agg(t), '[]'::json) as rows from (select ${select} from changed) t`;
    const result = await runAs(claims, sql);
    if (wantsRows) sendRows(req, res, result.rows[0].rows);
    else sendJson(res, 204);
    return;
  }

  if (req.method === "DELETE") {
    const sql = `with changed as (
      delete from ${target} ${whereClause(params)} returning *
    ) select coalesce(json_agg(t), '[]'::json) as rows from (select ${select} from changed) t`;
    const result = await runAs(claims, sql);
    if (wantsRows) sendRows(req, res, result.rows[0].rows);
    else sendJson(res, 204);
    return;
  }

  sendJson(res, 405, { message: "Método não simulado" });
}

// ---- auth
const users = new Map();
const refreshTokens = new Map();

function publicUser(user) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: user.created_at,
    phone: "",
    app_metadata: { provider: "email", providers: ["email"], ...user.app_metadata },
    user_metadata: {},
    identities: [],
    created_at: user.created_at,
    updated_at: user.created_at,
  };
}

function newSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const refresh_token = crypto.randomUUID();
  refreshTokens.set(refresh_token, user.id);
  return {
    access_token: sign({
      sub: user.id,
      role: "authenticated",
      aud: "authenticated",
      email: user.email,
      app_metadata: publicUser(user).app_metadata,
      iat: now,
      exp: now + 3600,
      session_id: crypto.randomUUID(),
    }),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token,
    user: publicUser(user),
  };
}

const authError = (res, status, code, msg) => sendJson(res, status, { code: status, error_code: code, msg });

async function handleAuth(req, res, url, rawBody) {
  const route = url.pathname.replace("/auth/v1", "");
  const body = rawBody.length ? JSON.parse(rawBody.toString()) : {};

  if (route === "/token") {
    if (url.searchParams.get("grant_type") === "refresh_token") {
      const userId = refreshTokens.get(body.refresh_token);
      if (!userId) return authError(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
      return sendJson(res, 200, newSession(users.get(userId)));
    }
    const user = [...users.values()].find((candidate) => candidate.email === body.email);
    if (!user || user.password !== body.password) {
      return authError(res, 400, "invalid_credentials", "Invalid login credentials");
    }
    return sendJson(res, 200, newSession(user));
  }

  if (route === "/user") {
    const claims = verify((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
    const user = claims?.sub && users.get(claims.sub);
    if (!user) return authError(res, 403, "bad_jwt", "invalid JWT");
    return sendJson(res, 200, publicUser(user));
  }

  if (route === "/logout") return sendJson(res, 204);

  if (route.startsWith("/admin/users")) {
    if (claimsOf(req).role !== "service_role") return authError(res, 403, "not_admin", "not admin");
    const id = route.split("/")[3];

    if (req.method === "POST") {
      const exists = [...users.values()].some((user) => user.email === body.email);
      if (exists) return authError(res, 422, "email_exists", "Email already registered");
      if ((body.password ?? "").length < 6) return authError(res, 422, "weak_password", "Weak password");
      const user = {
        id: crypto.randomUUID(),
        email: body.email,
        password: body.password,
        app_metadata: body.app_metadata ?? {},
        created_at: new Date().toISOString(),
      };
      users.set(user.id, user);
      await db.query("insert into auth.users (id) values ($1)", [user.id]);
      return sendJson(res, 200, publicUser(user));
    }

    if (req.method === "GET") {
      return sendJson(res, 200, { users: [...users.values()].map(publicUser), aud: "authenticated" }, {
        "x-total-count": String(users.size),
      });
    }

    const user = users.get(id);
    if (!user) return authError(res, 404, "user_not_found", "User not found");

    if (req.method === "PUT") {
      if (body.password) user.password = body.password;
      if (body.app_metadata) user.app_metadata = { ...user.app_metadata, ...body.app_metadata };
      return sendJson(res, 200, publicUser(user));
    }

    if (req.method === "DELETE") {
      users.delete(id);
      await db.query("delete from auth.users where id = $1", [id]);
      return sendJson(res, 200, publicUser(user));
    }
  }

  return sendJson(res, 404, { msg: `Rota de auth não simulada: ${route}` });
}

// ---- storage
const files = new Map();
const objectKey = (bucket, name) => `${bucket}/${name}`;

async function runStorage(claims, sql) {
  if (claims.role === "service_role") return db.query(sql);
  return runAs(claims, sql);
}

async function handleStorage(req, res, url, rawBody) {
  const route = decodeURIComponent(url.pathname.replace("/storage/v1", ""));
  const claims = claimsOf(req);

  const signBatch = route.match(/^\/object\/sign\/([^/]+)$/);
  if (signBatch && req.method === "POST") {
    const [, bucket] = signBatch;
    const { paths, expiresIn } = JSON.parse(rawBody.toString());
    const exp = Math.floor(Date.now() / 1000) + expiresIn;
    return sendJson(
      res,
      200,
      paths.map((name) => {
        if (!files.has(objectKey(bucket, name))) {
          return { path: name, signedURL: null, error: "Either the object does not exist or you do not have access to it" };
        }
        const token = sign({ url: objectKey(bucket, name), exp });
        return { path: name, signedURL: `/object/sign/${bucket}/${name}?token=${token}`, error: null };
      }),
    );
  }

  const signedGet = route.match(/^\/object\/sign\/([^/]+)\/(.+)$/);
  if (signedGet && (req.method === "GET" || req.method === "HEAD")) {
    const [, bucket, name] = signedGet;
    const claimsOfToken = verify(url.searchParams.get("token"));
    if (claimsOfToken?.url !== objectKey(bucket, name)) return sendJson(res, 400, { message: "token inválido" });
    const file = files.get(objectKey(bucket, name));
    if (!file) return sendJson(res, 404, { message: "not found" });

    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
    if (range) {
      const start = Number(range[1] || 0);
      const end = Math.min(Number(range[2] || file.data.length - 1), file.data.length - 1);
      res.writeHead(206, {
        "Content-Type": file.type,
        "Content-Range": `bytes ${start}-${end}/${file.data.length}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
      });
      res.end(file.data.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { "Content-Type": file.type, "Accept-Ranges": "bytes", "Content-Length": file.data.length });
    res.end(file.data);
    return;
  }

  const list = route.match(/^\/object\/list\/([^/]+)$/);
  if (list && req.method === "POST") {
    const [, bucket] = list;
    const { prefix } = JSON.parse(rawBody.toString());
    const start = `${bucket}/${prefix ? `${prefix}/` : ""}`;
    const names = [...files.keys()].filter((key) => key.startsWith(start)).map((key) => key.slice(start.length));
    return sendJson(res, 200, names.map((name) => ({ name, id: name })));
  }

  const remove = route.match(/^\/object\/([^/]+)$/);
  if (remove && req.method === "DELETE") {
    const [, bucket] = remove;
    const { prefixes } = JSON.parse(rawBody.toString());
    const names = prefixes.map(lit).join(",");
    const result = await runStorage(
      claims,
      `delete from storage.objects where bucket_id = ${lit(bucket)} and name in (${names}) returning name`,
    );
    for (const { name } of result.rows) files.delete(objectKey(bucket, name));
    return sendJson(res, 200, result.rows);
  }

  const upload = route.match(/^\/object\/([^/]+)\/(.+)$/);
  if (upload && req.method === "POST") {
    const [, bucket, name] = upload;
    const contentType = req.headers["content-type"] ?? "application/octet-stream";

    let data = rawBody;
    let type = contentType;
    if (contentType.startsWith("multipart/form-data")) {
      const form = await new Response(rawBody, { headers: { "content-type": contentType } }).formData();
      const file = [...form.values()].find((value) => typeof value !== "string");
      data = Buffer.from(await file.arrayBuffer());
      type = file.type || "application/octet-stream";
    }

    await runStorage(claims, `insert into storage.objects (bucket_id, name) values (${lit(bucket)}, ${lit(name)})`);
    files.set(objectKey(bucket, name), { data, type });
    return sendJson(res, 200, { Id: crypto.randomUUID(), Key: objectKey(bucket, name) });
  }

  return sendJson(res, 404, { message: `Rota de storage não simulada: ${route}` });
}

// ---- AbacatePay
const checkouts = new Map();
const webhookLog = [];

async function sendWebhook(event, data) {
  const payload = JSON.stringify({ id: `log_${crypto.randomUUID()}`, event, apiVersion: 2, devMode: true, data });
  const signature = crypto.createHmac("sha256", ABACATE_PUBLIC_KEY).update(payload).digest("base64");
  const response = await fetch(`${APP_URL}/api/webhooks/abacatepay?webhookSecret=${WEBHOOK_SECRET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Signature": signature },
    body: payload,
  });
  webhookLog.push({ event, status: response.status });
  return response.status;
}

async function handleAbacate(req, res, url, rawBody) {
  const route = url.pathname.replace("/v2", "");
  const body = rawBody.length ? JSON.parse(rawBody.toString()) : {};

  if (req.headers.authorization !== "Bearer chave-falsa") {
    return sendJson(res, 401, { data: null, error: "Unauthorized", success: false });
  }

  if (route === "/subscriptions/create") {
    const id = `bill_${crypto.randomUUID().slice(0, 8)}`;
    checkouts.set(id, body);
    return sendJson(res, 200, {
      data: { id, url: `http://localhost:${PORT}/fake-checkout/${id}` },
      error: null,
      success: true,
    });
  }

  if (route === "/subscriptions/cancel") {
    setTimeout(() => {
      sendWebhook("subscription.cancelled", { subscription: { id: body.id, status: "CANCELLED" } }).catch(console.error);
    }, 500);
    return sendJson(res, 200, { data: { id: body.id, status: "CANCELLED" }, error: null, success: true });
  }

  return sendJson(res, 404, { data: null, error: "rota não simulada", success: false });
}

function handleCheckoutPage(req, res, url) {
  const id = url.pathname.split("/")[2];
  const checkout = checkouts.get(id);
  if (!checkout) return sendJson(res, 404, { message: "checkout não existe" });

  if (req.method === "POST") {
    setTimeout(() => {
      sendWebhook("subscription.completed", {
        subscription: {
          id: `subs_${id.slice(5)}`,
          amount: 1990,
          status: "ACTIVE",
          method: "CARD",
          checkoutId: id,
          customerId: "cust_fake",
        },
      }).catch(console.error);
    }, WEBHOOK_DELAY_MS);
    res.writeHead(303, { Location: checkout.completionUrl });
    res.end();
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><title>Checkout falso</title><h1>Checkout falso</h1>
    <form method="post"><button id="pagar">Pagar</button></form>`);
}

// ---- servidor
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] ?? "*");
  res.setHeader("Access-Control-Expose-Headers", "content-range,x-total-count");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    const rawBody = await readBody(req);
    if (url.pathname.startsWith("/rest/v1/")) return await handleRest(req, res, url, rawBody);
    if (url.pathname.startsWith("/auth/v1/")) return await handleAuth(req, res, url, rawBody);
    if (url.pathname.startsWith("/storage/v1/")) return await handleStorage(req, res, url, rawBody);
    if (url.pathname.startsWith("/v2/")) return await handleAbacate(req, res, url, rawBody);
    if (url.pathname.startsWith("/fake-checkout/")) return handleCheckoutPage(req, res, url);

    // Só para as asserções do teste.
    if (url.pathname === "/__sql") {
      const result = await db.query(rawBody.toString());
      return sendJson(res, 200, result.rows);
    }
    if (url.pathname.startsWith("/__push/")) {
      pushLog.push({
        encoding: req.headers["content-encoding"],
        scheme: req.headers.authorization?.split(" ")[0],
        bytes: rawBody.length,
      });
      return sendJson(res, 201, {});
    }
    if (url.pathname === "/__pushes") return sendJson(res, 200, pushLog);
    if (url.pathname === "/__env") return sendJson(res, 200, APP_ENV);
    if (url.pathname === "/__webhooks") return sendJson(res, 200, webhookLog);
    if (url.pathname === "/__files") return sendJson(res, 200, [...files.keys()]);
    if (url.pathname === "/__webhook" && req.method === "POST") {
      const { event, data } = JSON.parse(rawBody.toString());
      return sendJson(res, 200, { status: await sendWebhook(event, data) });
    }

    sendJson(res, 404, { message: `Rota não simulada: ${url.pathname}` });
  } catch (error) {
    if (error.code || error.severity) return pgError(res, error);
    console.error(req.method, req.url, error);
    sendJson(res, 500, { message: String(error) });
  }
});

await setupDatabase();

server.listen(PORT, () => console.log(`Backend falso em http://localhost:${PORT}`));
