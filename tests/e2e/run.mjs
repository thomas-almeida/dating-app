// Sobe o backend falso, gera um build apontado para ele e roda a regressão no Chrome.
// Nada aqui toca o Supabase ou o AbacatePay de verdade: as variáveis do processo
// têm prioridade sobre o .env.local. Rode com `npm run test:e2e`.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const APP_PORT = 3100;
const BACKEND_PORT = 54399;
const APP_URL = `http://localhost:${APP_PORT}`;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const START_TIMEOUT_MS = 90000;
const POLL_INTERVAL_MS = 500;

const children = [];

function start(command, env) {
  const child = spawn(command, { cwd: projectRoot, env, shell: true, stdio: "ignore" });
  children.push(child);
  return child;
}

function stopAll() {
  for (const { pid } of children) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(pid);
  }
}

function run(command, env, input) {
  const { status } = spawnSync(command, {
    cwd: projectRoot,
    env,
    shell: true,
    input,
    stdio: [input ? "pipe" : "inherit", "inherit", "inherit"],
  });
  if (status !== 0) throw new Error(`Falhou: ${command}`);
}

async function waitFor(url) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await fetch(url).catch(() => null);
    if (response) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Não subiu: ${url}`);
}

async function main() {
  start("node tests/e2e/fake-backend.mjs", {
    ...process.env,
    E2E_APP_URL: APP_URL,
    E2E_BACKEND_PORT: String(BACKEND_PORT),
  });
  await waitFor(`${BACKEND_URL}/__env`);

  const fakeEnv = await (await fetch(`${BACKEND_URL}/__env`)).json();
  const env = {
    ...process.env,
    ...fakeEnv,
    E2E_DIST_DIR: ".next-e2e",
    E2E_DEPLOYMENT_ID: "e2e",
    E2E_APP_URL: APP_URL,
    E2E_BACKEND_URL: BACKEND_URL,
  };

  run("npx tsx scripts/create-admin.ts admin@exemplo.com", env, "nova-senha-admin\n");
  run("npx tsx scripts/seed-demo.ts", env);
  run("npx next build", env);

  start(`npx next start -p ${APP_PORT}`, env);
  await waitFor(APP_URL);

  run("node tests/e2e/regression.mjs", env);
}

main()
  .then(() => {
    stopAll();
    process.exit(0);
  })
  .catch((error) => {
    console.error(error.message);
    stopAll();
    process.exit(1);
  });
