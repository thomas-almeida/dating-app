// Aplica as migrations num Postgres em memória (PGlite), com os schemas auth e
// storage simulados, e confere as regras de acesso. Roda com `npm run test:db`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ids = {
  ana: "00000000-0000-4000-8000-000000000001",
  bruno: "00000000-0000-4000-8000-000000000002",
  carlos: "00000000-0000-4000-8000-000000000003",
  dora: "00000000-0000-4000-8000-000000000004",
  intruso: "00000000-0000-4000-8000-000000000009",
};

const db = new PGlite();
let failures = 0;

function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${!ok && detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ""}`);
}

async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  const role = uid ? "authenticated" : "anon";
  const claims = JSON.stringify(uid ? { sub: uid, role } : { role });
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
  await db.exec(`set role ${role}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

async function denied(label: string, uid: string | null, sql: string, params: unknown[] = []) {
  try {
    const rows = await as(uid, sql, params);
    check(label, false, rows);
  } catch {
    check(label, true);
  }
}

// Devolve a mensagem do erro, ou null se a chamada passou.
async function errorOf(uid: string | null, sql: string, params: unknown[] = []) {
  try {
    await as(uid, sql, params);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

async function setup() {
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
    -- Reproduz o padrão do Supabase, que os grants da migration precisam desfazer.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);

  const migrations = join(process.cwd(), "supabase/migrations");
  for (const file of readdirSync(migrations).sort()) {
    await db.exec(readFileSync(join(migrations, file), "utf8"));
  }

  for (const id of [ids.ana, ids.bruno, ids.carlos, ids.intruso]) {
    await db.query("insert into auth.users (id) values ($1)", [id]);
  }

  await db.query(
    `insert into public.profiles (id, name, nickname, bio, gender, birth_date, photo_paths)
     values
       ($1::uuid, 'Ana', 'Aninha', 'Oi', 'female', '2000-01-01', array[$1::text || '/a.jpg']),
       ($2::uuid, 'Bruno', 'Bru', 'Oi', 'male', '1999-05-05', array[$2::text || '/b.jpg']),
       ($3::uuid, 'Carlos', 'Cacá', 'Oi', 'male', '1998-02-02', array[$3::text || '/c.jpg'])`,
    [ids.ana, ids.bruno, ids.carlos],
  );
  await db.query(
    `insert into public.profile_contacts (user_id, whatsapp)
     values ($1, '5511999990001'), ($2, '5511999990002'), ($3, '5511999990003')`,
    [ids.ana, ids.bruno, ids.carlos],
  );
  await db.query(
    "insert into public.waitlist (name, email, phone) values ('Fulana', 'fulana@example.com', '5511988887777')",
  );
}

async function testDeck() {
  // Bruno ainda não passou pela Dora: quem não foi visto vem antes de quem já foi.
  await db.query("insert into auth.users (id) values ($1)", [ids.dora]);
  await db.query(
    `insert into public.profiles (id, name, nickname, bio, gender, birth_date, photo_paths)
     values ($1::uuid, 'Dora', 'Dorinha', 'Oi', 'female', '2001-03-03', array[$1::text || '/d.jpg'])`,
    [ids.dora],
  );
  const order = await as(ids.bruno, "select id from public.discover_profiles()");
  check("descoberta mostra primeiro quem não foi visto", order[0]?.id === ids.dora && order.length === 2, order);

  const relike = await as<{ m: boolean }>(ids.bruno, "select public.record_swipe($1, 'like') as m", [ids.ana]);
  check("curtir de novo não repete o match", relike[0].m === false, relike);
  await as(ids.bruno, "select public.record_swipe($1, 'pass')", [ids.ana]);
  const noMatch = await as(ids.ana, "select * from public.my_matches()");
  check("passar desfaz o match", noMatch.length === 0, noMatch);
  const back = await as<{ m: boolean }>(ids.bruno, "select public.record_swipe($1, 'like') as m", [ids.ana]);
  check("curtir depois de passar é match de novo", back[0].m === true, back);
  const swipes = await db.query<{ n: number }>("select count(*)::int as n from public.swipes where swiper_id = $1 and target_id = $2", [ids.bruno, ids.ana]);
  check("rever não duplica o swipe", swipes.rows[0].n === 1, swipes.rows);
}

async function testStories() {
  const post = (uid: string | null, path: string) =>
    as<{ id: string }>(uid, "select public.post_story($1, 'image') as id", [path]);
  const feed = (uid: string) => as<{ id: string; user_id: string }>(uid, "select * from public.story_feed()");

  // Limite
  const [story] = await post(ids.ana, `${ids.ana}/s1.jpg`);
  check("free posta o story do dia", Boolean(story?.id), story);
  const limit = await errorOf(ids.ana, "select public.post_story($1, 'image')", [`${ids.ana}/s2.jpg`]);
  check("free não posta o segundo no mesmo dia", limit === "story_limit", limit);

  await db.query("update public.stories set created_at = now() - interval '25 hours' where user_id = $1", [ids.ana]);
  const [next] = await post(ids.ana, `${ids.ana}/s3.jpg`);
  check("depois de 24 horas o free posta de novo", Boolean(next?.id), next);

  await db.query("update public.profiles set is_pro = true where id = $1", [ids.bruno]);
  await post(ids.bruno, `${ids.bruno}/s1.jpg`);
  await post(ids.bruno, `${ids.bruno}/s2.jpg`);
  const proStories = await feed(ids.bruno);
  check("Pro posta sem limite", proStories.filter(({ user_id }) => user_id === ids.bruno).length === 2, proStories);

  const foreign = await errorOf(ids.carlos, "select public.post_story($1, 'image')", [`${ids.ana}/alheio.jpg`]);
  check("não posta arquivo de outra pessoa", foreign === "foreign_media", foreign);
  const ghost = await errorOf(ids.intruso, "select public.post_story($1, 'image')", [`${ids.intruso}/s.jpg`]);
  check("sem perfil não posta", ghost === "not_onboarded", ghost);
  const badType = await errorOf(ids.carlos, "select public.post_story($1, 'audio')", [`${ids.carlos}/s.mp3`]);
  check("tipo de mídia desconhecido é recusado", badType !== null, badType);

  // Acesso direto
  await denied("anon não posta story", null, "select public.post_story('a/b.jpg', 'image')");
  await denied("anon não lê stories", null, "select * from public.story_feed()");
  await denied("membro não lê stories direto", ids.ana, "select * from public.stories");
  await denied("membro não grava story direto", ids.ana, "insert into public.stories (user_id, media_path, media_type) values ($1, 'x', 'image')", [ids.ana]);
  await denied("membro não lê quem viu direto", ids.ana, "select * from public.story_views");
  await denied("membro não lê curtidas direto", ids.ana, "select * from public.story_likes");
  await denied("membro não forja visualização", ids.ana, "insert into public.story_views (story_id, viewer_id) values ($1, $2)", [next.id, ids.ana]);
  await denied("regra interna não é pública", ids.ana, "select public.can_view_story($1)", [next.id]);

  // Quem vê o quê
  const freeFeed = await feed(ids.ana);
  check("free recebe só o próprio story", freeFeed.length === 1 && freeFeed[0].user_id === ids.ana, freeFeed);
  const carlosFeed = await feed(ids.carlos);
  check("free não recebe stories de ninguém", carlosFeed.length === 0, carlosFeed);
  const proFeed = await feed(ids.bruno);
  check("Pro recebe stories do sexo oposto", proFeed.some(({ user_id }) => user_id === ids.ana), proFeed);
  check("story vencido sai do feed", !proFeed.some(({ id }) => id === story.id), proFeed);

  await db.query("update public.profiles set is_pro = true where id = $1", [ids.carlos]);
  const sameGender = await feed(ids.carlos);
  check("Pro não recebe stories do mesmo sexo", !sameGender.some(({ user_id }) => user_id === ids.bruno), sameGender);
  await db.query("update public.profiles set is_pro = false where id = $1", [ids.carlos]);

  const row = await as<{ has_story: boolean; id: string }>(ids.bruno, "select * from public.story_profiles()");
  check("quem tem story vem primeiro", row[0]?.id === ids.ana && row[0]?.has_story === true, row);

  // Visualizações e curtidas
  await as(ids.carlos, "select public.view_story($1)", [next.id]);
  await as(ids.ana, "select public.view_story($1)", [next.id]);
  await as(ids.bruno, "select public.view_story($1)", [next.id]);
  await as(ids.bruno, "select public.view_story($1)", [next.id]);
  const audience = await as<{ user_id: string; liked: boolean }>(ids.ana, "select * from public.story_audience($1)", [next.id]);
  check("dono vê quem viu, uma vez por pessoa", audience.length === 1 && audience[0].user_id === ids.bruno, audience);

  const toggle = () => as<{ liked: boolean }>(ids.bruno, "select public.toggle_story_like($1) as liked", [next.id]);
  check("curtir story", (await toggle())[0].liked === true);
  check("segundo toque descurte", (await toggle())[0].liked === false);
  check("terceiro toque curte de novo", (await toggle())[0].liked === true);

  const likedRow = await as<{ liked: boolean }>(ids.ana, "select * from public.story_audience($1)", [next.id]);
  check("dono vê quem curtiu", likedRow[0]?.liked === true, likedRow);
  const likedFeed = await as<{ id: string; liked: boolean }>(ids.bruno, "select * from public.story_feed()");
  check("feed sabe o que já foi curtido", likedFeed.find(({ id }) => id === next.id)?.liked === true, likedFeed);

  const freeLike = await errorOf(ids.carlos, "select public.toggle_story_like($1)", [next.id]);
  check("free não curte story", freeLike === "invalid_story", freeLike);
  const ownLike = await errorOf(ids.ana, "select public.toggle_story_like($1)", [next.id]);
  check("não curte o próprio story", ownLike === "invalid_story", ownLike);

  const stranger = await as(ids.bruno, "select * from public.story_audience($1)", [next.id]);
  check("só o dono vê a audiência", stranger.length === 0, stranger);

  await db.query("update public.stories set created_at = now() - interval '25 hours' where id = $1", [next.id]);
  const expired = await errorOf(ids.bruno, "select public.toggle_story_like($1)", [next.id]);
  check("story vencido não recebe curtida", expired === "invalid_story", expired);

  await db.query("update public.profiles set is_pro = false where id = $1", [ids.bruno]);
}

async function testInsights() {
  await as(ids.bruno, "select public.record_profile_view($1)", [ids.ana]);
  await as(ids.bruno, "select public.record_profile_view($1)", [ids.ana]);
  await as(ids.ana, "select public.record_profile_view($1)", [ids.ana]);
  await as(ids.intruso, "select public.record_profile_view($1)", [ids.ana]);

  const views = await db.query<{ n: number }>("select count(*)::int as n from public.profile_views where profile_id = $1", [ids.ana]);
  check("visita conta uma vez por dia, sem contar a própria", views.rows[0].n === 1, views.rows);

  await denied("anon não registra visita", null, "select public.record_profile_view($1)", [ids.ana]);
  await denied("membro não lê visitas direto", ids.ana, "select * from public.profile_views");
  await denied("anon não vê métricas", null, "select * from public.my_insights()");

  const free = await as(ids.ana, "select * from public.my_insights()");
  check("free não recebe métricas", free.length === 0, free);
  const freeLikers = await as(ids.ana, "select * from public.my_likers()");
  check("free não recebe quem curtiu", freeLikers.length === 0, freeLikers);

  await db.query("update public.profiles set is_pro = true where id = $1", [ids.ana]);
  const insights = await as<{ profile_views: number | string; likes_received: number | string }>(ids.ana, "select * from public.my_insights()");
  check(
    "Pro vê visitas e curtidas",
    Number(insights[0]?.profile_views) === 1 && Number(insights[0]?.likes_received) === 1,
    insights,
  );
  const likers = await as<{ id: string }>(ids.ana, "select * from public.my_likers()");
  check("Pro vê quem curtiu", likers.length === 1 && likers[0].id === ids.bruno, likers);
  check("quem curtiu não expõe birth_date", !("birth_date" in likers[0]), likers[0]);
  await db.query("update public.profiles set is_pro = false where id = $1", [ids.ana]);
}

async function run() {
  await setup();

  const onboarded = await db.query<{ n: number }>(
    "select count(*)::int as n from public.profiles where onboarded_at is not null",
  );
  check("trigger marca perfis completos como prontos", onboarded.rows[0].n === 3, onboarded.rows);

  // Isolamento
  await denied("anon não lê waitlist", null, "select * from public.waitlist");
  await denied("anon não grava waitlist", null, "insert into public.waitlist (name, email, phone) values ('x y', 'x@y.z', '5511999999999')");
  await denied("membro não lê waitlist", ids.ana, "select * from public.waitlist");
  await denied("membro não lê swipes", ids.ana, "select * from public.swipes");
  await denied("membro não lê payment_events", ids.ana, "select * from public.payment_events");
  await denied("anon não chama discover", null, "select * from public.discover_profiles()");
  await denied("membro não insere perfil", ids.intruso, "insert into public.profiles (id, name) values ($1, 'x')", [ids.intruso]);

  const visible = await as(ids.ana, "select id from public.profiles");
  check("perfis: só o próprio", visible.length === 1 && visible[0].id === ids.ana, visible);

  // Colunas protegidas
  await denied("usuário não muda is_pro", ids.ana, "update public.profiles set is_pro = true where id = $1", [ids.ana]);
  await denied("usuário não muda onboarded_at", ids.ana, "update public.profiles set onboarded_at = now() where id = $1", [ids.ana]);

  // Regras de perfil
  await denied("menor de idade barrado", ids.ana, "update public.profiles set birth_date = current_date - 365 where id = $1", [ids.ana]);
  await denied("no máximo 2 fotos", ids.ana, "update public.profiles set photo_paths = array[$1::text || '/1', $1::text || '/2', $1::text || '/3'] where id = $1::uuid", [ids.ana]);
  await denied("mídia de outra pessoa barrada", ids.ana, "update public.profiles set video_path = $2 where id = $1", [ids.ana, `${ids.bruno}/v.mp4`]);
  await as(ids.ana, "update public.profiles set bio = 'Nova bio' where id = $1", [ids.ana]);
  const bio = await db.query<{ bio: string }>("select bio from public.profiles where id = $1", [ids.ana]);
  check("usuário edita a bio", bio.rows[0].bio === "Nova bio", bio.rows);

  // WhatsApp
  const contactsFree = await as(ids.ana, "select * from public.profile_contacts");
  check("não Pro só vê o próprio WhatsApp", contactsFree.length === 1 && contactsFree[0].user_id === ids.ana, contactsFree);
  await db.query("update public.profiles set is_pro = true where id = $1", [ids.ana]);
  const contactsPro = await as(ids.ana, "select * from public.profile_contacts");
  check("Pro vê os WhatsApps", contactsPro.length === 3, contactsPro);
  await db.query("update public.profiles set is_pro = false where id = $1", [ids.ana]);
  await as(ids.bruno, "update public.profile_contacts set whatsapp = '5511900000000' where user_id = $1", [ids.ana]);
  const untouched = await db.query<{ whatsapp: string }>("select whatsapp from public.profile_contacts where user_id = $1", [ids.ana]);
  check("não altera WhatsApp alheio", untouched.rows[0].whatsapp === "5511999990001", untouched.rows);

  // Descoberta
  const discover = await as(ids.ana, "select * from public.discover_profiles()");
  check("descoberta mostra o sexo oposto", discover.length === 2 && discover.every((p) => p.id !== ids.ana), discover);
  check("descoberta não expõe birth_date", !("birth_date" in discover[0]), discover[0]);
  check("idade calculada", typeof discover[0].age === "number" && (discover[0].age as number) >= 18, discover[0]);
  const stories = await as(ids.ana, "select * from public.story_profiles()");
  check("stories trazem foto", stories.length === 2 && Boolean(stories[0].photo_path), stories);
  const ghost = await as(ids.intruso, "select * from public.discover_profiles()");
  check("sem perfil, descoberta vazia", ghost.length === 0, ghost);

  // Swipes e match
  const first = await as<{ m: boolean }>(ids.ana, "select public.record_swipe($1, 'like') as m", [ids.bruno]);
  check("primeiro like não é match", first[0].m === false, first);
  const second = await as<{ m: boolean }>(ids.bruno, "select public.record_swipe($1, 'like') as m", [ids.ana]);
  check("like de volta é match", second[0].m === true, second);
  const pass = await as<{ m: boolean }>(ids.ana, "select public.record_swipe($1, 'pass') as m", [ids.carlos]);
  check("dispensar não é match", pass[0].m === false, pass);
  const afterSwipes = await as(ids.ana, "select * from public.discover_profiles()");
  check("quem já passou volta para a descoberta", afterSwipes.length === 2, afterSwipes);
  const matches = await as(ids.ana, "select * from public.my_matches()");
  check("match aparece para os dois", matches.length === 1 && matches[0].id === ids.bruno, matches);
  await denied("não dá like em si", ids.ana, "select public.record_swipe($1, 'like')", [ids.ana]);
  await denied("não dá like no mesmo sexo", ids.bruno, "select public.record_swipe($1, 'like')", [ids.carlos]);
  await denied("sem perfil não dá like", ids.intruso, "select public.record_swipe($1, 'like')", [ids.ana]);

  const profile = await as(ids.ana, "select * from public.get_public_profile($1)", [ids.bruno]);
  check("perfil público marca o match", profile.length === 1 && profile[0].is_match === true, profile);
  check("perfil público não expõe birth_date", !("birth_date" in profile[0]), profile[0]);
  const outsider = await as(ids.intruso, "select * from public.get_public_profile($1)", [ids.ana]);
  check("sem perfil, nada de perfil público", outsider.length === 0, outsider);

  // Storage
  await as(ids.ana, "insert into storage.objects (bucket_id, name) values ('media', $1)", [`${ids.ana}/foto.jpg`]);
  check("upload na própria pasta", true);
  await denied("upload na pasta alheia", ids.ana, "insert into storage.objects (bucket_id, name) values ('media', $1)", [`${ids.bruno}/foto.jpg`]);
  await denied("sem perfil não faz upload", ids.intruso, "insert into storage.objects (bucket_id, name) values ('media', $1)", [`${ids.intruso}/foto.jpg`]);
  const objects = await as(ids.bruno, "select * from storage.objects");
  check("não lista arquivos alheios direto", objects.length === 0, objects);

  await testDeck();
  await testStories();
  await testInsights();

  // Assinaturas
  await db.query("insert into public.subscriptions (user_id, checkout_id) values ($1, 'bill_1')", [ids.ana]);
  const mine = await as(ids.ana, "select * from public.subscriptions");
  const theirs = await as(ids.bruno, "select * from public.subscriptions");
  check("assinatura só para o dono", mine.length === 1 && theirs.length === 0, { mine, theirs });
  await denied("usuário não grava assinatura", ids.ana, "update public.subscriptions set status = 'active'");

  console.log(failures === 0 ? "\nTudo certo." : `\n${failures} falha(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
