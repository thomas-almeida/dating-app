// Regressão de ponta a ponta. Rode com `npm run test:e2e`, que sobe tudo isto antes.
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "../..");

const APP = process.env.E2E_APP_URL;
const BACKEND = process.env.E2E_BACKEND_URL;
const output = path.join(here, ".output");
const shots = path.join(output, "shots");
mkdirSync(shots, { recursive: true });

const stamp = Date.now();
const EMAIL = `joao.${stamp}@exemplo.com`;
const PASSWORD = "senha-forte-1";

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${!ok && detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ""}`);
}

async function sql(query) {
  const response = await fetch(`${BACKEND}/__sql`, { method: "POST", body: query });
  return response.json();
}

const browser = await chromium.launch({ channel: "chrome", headless: true });

const mobile = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "pt-BR",
  timezoneId: "America/Sao_Paulo",
};

const problems = [];
function watch(page, label) {
  page.on("pageerror", (error) => problems.push(`${label} pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`${label} console: ${message.text()} @ ${message.location().url}`);
  });
}

const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`) });

// ---- mídia de teste
const photoPath = path.join(output, "foto.jpg");
await sharp({
  create: { width: 1800, height: 2400, channels: 3, background: { r: 200, g: 90, b: 110 } },
})
  .jpeg()
  .toFile(photoPath);

const videoPath = path.join(here, "fixtures/video.webm");

// ---- LP e lista de espera
const visitor = await browser.newContext(mobile);
const lp = await visitor.newPage();
watch(lp, "lp");
await lp.goto(APP);
await lp.waitForLoadState("networkidle");
await shot(lp, "01-lp");
check("LP tem o gradiente animado", (await lp.locator("main > .animate-brand-gradient:visible").count()) === 1);

await lp.getByLabel("Nome").fill("João Pedro");
await lp.getByLabel("E-mail").fill(EMAIL);
await lp.getByLabel("Telefone").fill("1199");
await lp.getByRole("checkbox").check();
await lp.getByRole("button", { name: "Entrar na lista de espera" }).click();
await lp.locator('form [role="alert"]').waitFor();
check("telefone inválido mostra erro", (await lp.locator('form [role="alert"]').innerText()).includes("DDD"));
check("erro mantém o nome digitado", (await lp.getByLabel("Nome").inputValue()) === "João Pedro");
check("erro mantém o aceite", await lp.getByRole("checkbox").isChecked());

await lp.getByLabel("Telefone").fill("11912345678");
await lp.getByRole("button", { name: "Entrar na lista de espera" }).click();
await lp.getByText("Recebemos o seu cadastro").waitFor();
await shot(lp, "02-lp-sucesso");
check("cadastro entra como pendente", (await sql(`select status from waitlist where email='${EMAIL}'`))[0]?.status === "pending");

// ---- admin
const adminContext = await browser.newContext(mobile);
const admin = await adminContext.newPage();
watch(admin, "admin");

await admin.goto(`${APP}/admin`);
await admin.waitForURL("**/entrar**");
check("admin sem sessão vai para o login", admin.url().includes("/entrar"));

await admin.getByLabel("E-mail").fill("admin@exemplo.com");
await admin.getByLabel("Senha").fill("errada-123");
await admin.getByRole("button", { name: "Entrar" }).click();
await admin.getByText("E-mail ou senha incorretos.").waitFor();
check("senha errada mantém o e-mail", (await admin.getByLabel("E-mail").inputValue()) === "admin@exemplo.com");
await shot(admin, "03-login-erro");
check("login tem o gradiente animado", (await admin.locator("main > .animate-brand-gradient:visible").count()) === 1);

await admin.getByLabel("Senha").fill("nova-senha-admin");
await admin.getByRole("button", { name: "Entrar" }).click();
await admin.waitForURL("**/admin");
await admin.getByText("João Pedro").waitFor();
await shot(admin, "04-admin");

await admin.getByRole("listitem").filter({ hasText: "João Pedro" }).getByRole("button", { name: "Aprovar" }).click();
await admin.getByRole("dialog").waitFor();
await shot(admin, "05-admin-convite");
const inviteUrl = await admin.getByLabel("Link do convite").inputValue();
check("convite gerado", inviteUrl.startsWith(`${APP}/convite/`), inviteUrl);
await admin.getByRole("button", { name: "Fechar" }).click();

// ---- outras ações do admin
const insertWaitlist = (name, email, phone) =>
  sql(`insert into waitlist (name, email, phone) values ('${name}', '${email}', '${phone}')`);
await insertWaitlist("Recusada Silva", `recusada.${stamp}@exemplo.com`, "5511911111111");
await insertWaitlist("Nova Tentativa", `nova.${stamp}@exemplo.com`, "5511922222222");
await admin.reload();

await admin.getByRole("listitem").filter({ hasText: "Recusada Silva" }).getByRole("button", { name: "Recusar" }).click();
await admin.getByText("Recusada Silva").waitFor({ state: "hidden" });
const rejected = await sql(`select status from waitlist where email='recusada.${stamp}@exemplo.com'`);
check("recusar marca a pessoa", rejected[0].status === "rejected", rejected);

await admin.getByRole("listitem").filter({ hasText: "Nova Tentativa" }).getByRole("button", { name: "Aprovar" }).click();
await admin.getByRole("dialog").waitFor();
const firstLink = await admin.getByLabel("Link do convite").inputValue();
await admin.getByRole("button", { name: "Fechar" }).click();
await admin.getByRole("link", { name: /Aprovados/ }).click();
await admin.waitForURL("**/admin?status=approved");
await admin.getByRole("listitem").filter({ hasText: "Nova Tentativa" }).getByRole("button", { name: "Gerar novo link" }).click();
await admin.getByRole("dialog").waitFor();
const secondLink = await admin.getByLabel("Link do convite").inputValue();
await admin.getByRole("button", { name: "Fechar" }).click();
check("novo link é outro", firstLink !== secondLink);
{
  const context = await browser.newContext(mobile);
  const page = await context.newPage();
  await page.goto(firstLink);
  await page.getByText("Esse convite não vale mais").waitFor();
  await page.goto(secondLink);
  await page.getByText("Você foi aprovado, Nova").waitFor();
  check("link antigo morre quando sai um novo", true);
  await context.close();
}

// ---- convite
const userContext = await browser.newContext(mobile);
const user = await userContext.newPage();
watch(user, "user");

await user.goto(`${APP}/convite/token-que-nao-existe`);
await user.getByText("Esse convite não vale mais").waitFor();
check("convite inválido é recusado", true);

await user.goto(inviteUrl);
await user.getByText("Você foi aprovado, João").waitFor();
await shot(user, "06-convite");
await user.getByLabel("Crie uma senha").fill(PASSWORD).catch(async () => {
  await user.locator('input[name="password"]').fill(PASSWORD);
});
await user.locator('input[name="confirm"]').fill(PASSWORD);
await user.getByRole("button").first().click();
await user.waitForURL("**/perfil/editar");
check("senha criada leva para o perfil", user.url().endsWith("/perfil/editar"));

const reuse = await browser.newContext(mobile);
const reusePage = await reuse.newPage();
await reusePage.goto(inviteUrl);
await reusePage.getByText("Esse convite não vale mais").waitFor();
check("convite usado não vale de novo", true);
await reuse.close();

await user.goto(`${APP}/inicio`);
await user.waitForURL("**/perfil/editar");
check("home bloqueada sem perfil completo", user.url().endsWith("/perfil/editar"));

// ---- onboarding
await user.getByLabel("Apelido").waitFor();
await shot(user, "07-onboarding-vazio");

await user.locator('input[accept="image/*"]').first().setInputFiles(photoPath);
await user.locator('input[name="photo_paths"]').first().waitFor({ state: "attached" });
await user.locator('input[accept^="video/"]').setInputFiles(videoPath);
await user.locator('input[name="video_path"]').waitFor({ state: "attached", timeout: 15000 });

const uploaded = await (await fetch(`${BACKEND}/__files`)).json();
const userId = (await sql(`select user_id from waitlist where email='${EMAIL}'`))[0].user_id;
const ownFiles = uploaded.filter((key) => key.includes(userId));
check("foto e vídeo foram para o Storage", ownFiles.length === 2, ownFiles);

await user.getByLabel("Apelido").fill("Jota");
await user.getByLabel("Bio").fill("Louvor, futebol e café. Procuro alguém para caminhar junto.");
await user.getByText("Homem", { exact: true }).click();
await user.getByLabel("Data de nascimento").fill("2015-01-01");
await user.getByLabel("WhatsApp").fill("11987654321");
await shot(user, "08-onboarding-preenchido");

await user.getByRole("button", { name: "Concluir perfil" }).click();
await user.getByText("O app é só para maiores de 18 anos.").waitFor();
check("menor de idade é barrado", true);
check("erro mantém a bio", (await user.getByLabel("Bio").inputValue()).startsWith("Louvor"));
check("erro mantém a mídia", (await user.locator('input[name="photo_paths"]').count()) === 1);

await user.getByLabel("Data de nascimento").fill("2000-01-01");
await user.getByRole("button", { name: "Concluir perfil" }).click();
await user.waitForURL("**/inicio");
check("perfil completo libera a home", user.url().endsWith("/inicio"));

// Metade dos perfis de exemplo curte o usuário novo.
execSync("npx tsx scripts/seed-demo.ts", { cwd: projectRoot, env: process.env, stdio: "pipe" });
await user.reload();

// ---- home
await user.getByRole("button", { name: "Curtir" }).waitFor();
await user.waitForTimeout(600);
await shot(user, "09-home");
check("home tem o gradiente animado", (await user.locator("main > .animate-brand-gradient:visible").count()) === 1);
const liveLayers = await user
  .locator("main > .animate-brand-gradient:visible")
  .evaluate((layer) => layer.getAnimations({ subtree: true }).map((animation) => animation.animationName));
check(
  "fundo tem as bolhas animadas",
  liveLayers.filter((name) => name === "blob-drift").length === 3 && liveLayers.filter((name) => name === "bubble-rise").length === 6,
  liveLayers,
);

const storyCount = await user.getByRole("list", { name: "Stories" }).getByRole("listitem").count();
check("stories aparecem", storyCount > 0, storyCount);

await user.getByRole("list", { name: "Stories" }).getByRole("button", { name: /recurso Pro/ }).first().click();
await user.getByText("Stories são do Pro").waitFor();
await user.waitForTimeout(400);
await shot(user, "10-paywall-stories");
await user.keyboard.press("Escape");
await user.getByText("Stories são do Pro").waitFor({ state: "hidden" });
check("story bloqueado abre o paywall e não abre story", user.url().endsWith("/inicio"));

// Arrasto com o ponteiro.
const card = user.getByRole("article");
const firstName = await card.getAttribute("aria-label");
const box = await card.boundingBox();
await user.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
await user.mouse.down();
await user.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 3, { steps: 6 });
await user.waitForTimeout(120);
await shot(user, "11-arrasto");
await user.mouse.move(box.x + box.width / 2 + 260, box.y + box.height / 3, { steps: 6 });
await user.mouse.up();
await user.waitForTimeout(700);
const afterDrag = await card.getAttribute("aria-label").catch(() => null);
check("arrastar troca o card", afterDrag !== firstName, { firstName, afterDrag });
const dragLikes = await sql(`select count(*)::int as n from swipes where swiper_id='${userId}'`);
check("arrasto foi gravado", dragLikes[0].n === 1, dragLikes);

// Curte as outras pessoas do deck.
let matches = 0;
const overlay = user.getByRole("dialog");
async function dismissMatch() {
  if ((await overlay.count()) === 0) return false;
  matches += 1;
  if (matches === 1) await shot(user, "12-match");
  await user.getByRole("button", { name: "Continuar" }).click();
  await user.waitForTimeout(350);
  return true;
}
async function likeCards(total) {
  for (let liked = 0; liked < total; ) {
    if (await dismissMatch()) continue;
    await user.getByRole("button", { name: "Curtir" }).click();
    liked += 1;
    await user.waitForTimeout(650);
  }
  await user.waitForTimeout(800);
  await dismissMatch();
}

await likeCards(3);
check("curtidas recíprocas viram match", matches >= 1, matches);

await card.waitFor();
check("depois da última pessoa, o deck recomeça", await card.isVisible());
await shot(user, "13-deck-recomeca");

const matchesBefore = matches;
await likeCards(4);
check("curtir de novo não repete o match", matches === matchesBefore, { matches, matchesBefore });

const swipes = await sql(`select count(*)::int as n from swipes where swiper_id='${userId}'`);
check("rever pessoas não duplica os swipes", swipes[0].n === 4, swipes);

// ---- matches e perfil
await user.getByRole("link", { name: "Matches" }).click();
await user.waitForURL("**/matches");
await user.getByRole("heading", { name: "Matches" }).waitFor();
await user.locator('a[href^="/perfil/"]').first().waitFor();
await shot(user, "14-matches");

await user.locator('main a[href^="/perfil/"]').first().click();
await user.waitForURL(/\/perfil\/[0-9a-f-]{36}$/);
await user.getByRole("button", { name: "Mandar mensagem no WhatsApp" }).waitFor();
await shot(user, "15-perfil-outro");

const freeButton = user.getByRole("button", { name: "Mandar mensagem no WhatsApp" });
check(
  "botão de quem é free tem o logo e não tem cadeado",
  (await freeButton.locator("img").count()) === 1 && (await freeButton.locator("svg").count()) === 0,
);
const freeIcon = await freeButton.locator("img").evaluate((image) => ({ loaded: image.complete && image.naturalWidth > 0, width: image.width }));
check("logo do WhatsApp carrega", freeIcon.loaded && freeIcon.width === 24, freeIcon);
const freeColors = await freeButton.evaluate((element) => {
  const style = getComputedStyle(element);
  return { background: style.backgroundColor, color: style.color };
});
check("botão verde com texto branco", freeColors.color === "rgb(255, 255, 255)", freeColors);

const html = await user.content();
check("número do WhatsApp não chega a quem não é Pro", !html.includes("551190000"));

await user.getByRole("button", { name: "Mandar mensagem no WhatsApp" }).click();
await user.getByText("WhatsApp é do Pro").waitFor();
await user.waitForTimeout(400);
await shot(user, "16-paywall-whatsapp");
await user.getByRole("link", { name: "Conhecer o Pro" }).click();
await user.waitForURL("**/pro");

// ---- Pro
await user.getByRole("button", { name: "Assinar o Pro" }).waitFor();
await shot(user, "17-pro");
await user.getByRole("button", { name: "Assinar o Pro" }).click();
await user.waitForURL("**/fake-checkout/**");
await user.locator("#pagar").click();
await user.waitForURL("**/pro?status=ok");
await user.getByText("Estamos confirmando").waitFor();
await shot(user, "18-pro-confirmando");
await user.getByText("Seu Pro está ativo.").waitFor({ timeout: 20000 });
await shot(user, "19-pro-ativo");
check("webhook liga o Pro e a tela atualiza sozinha", true);

const row = await sql(`select status, subscription_id, customer_id from subscriptions where user_id='${userId}'`);
check("assinatura guarda subs_ e cliente", row[0]?.status === "active" && row[0]?.subscription_id?.startsWith("subs_") && row[0]?.customer_id === "cust_fake", row);

await user.goto(`${APP}/matches`);
await user.locator('main a[href^="/perfil/"]').first().click();
await user.waitForURL(/\/perfil\/[0-9a-f-]{36}$/);
const whatsapp = user.getByRole("link", { name: "Mandar mensagem no WhatsApp" });
await whatsapp.waitFor();
const href = await whatsapp.getAttribute("href");
check("Pro recebe o link do WhatsApp", href.startsWith("https://wa.me/551190000"), href);
check("link de quem é Pro também tem o logo", (await whatsapp.locator("img").count()) === 1);
await user.waitForTimeout(300);
await shot(user, "28-perfil-pro");

await user.goto(`${APP}/inicio`);
await user.getByRole("list", { name: "Stories" }).getByRole("link").first().waitFor();
await shot(user, "20-home-pro");
await user.getByRole("list", { name: "Stories" }).getByRole("link").first().click();
await user.waitForURL(/\/perfil\/[0-9a-f-]{36}$/);
check("Pro toca no story e abre o perfil", true);

await user.goto(`${APP}/pro`);
await user.getByRole("button", { name: "Cancelar assinatura" }).click();
await user.getByRole("button", { name: "Cancelar agora" }).waitFor();
await shot(user, "21-pro-cancelar");
await user.getByRole("button", { name: "Cancelar agora" }).click();
await user.getByRole("button", { name: "Assinar o Pro" }).waitFor({ timeout: 15000 });
await user.waitForTimeout(1200);
const after = await sql(`select p.is_pro, s.status from profiles p join subscriptions s on s.user_id=p.id where p.id='${userId}'`);
check("cancelar desliga o Pro na hora", after[0]?.is_pro === false && after[0]?.status === "cancelled", after);

const hooks = await (await fetch(`${BACKEND}/__webhooks`)).json();
check("webhooks responderam 200", hooks.length >= 2 && hooks.every(({ status }) => status === 200), hooks);

// Evento atrasado não reativa quem cancelou.
const late = await fetch(`${BACKEND}/__webhook`, {
  method: "POST",
  body: JSON.stringify({ event: "subscription.renewed", data: { subscription: { id: row[0].subscription_id } } }),
});
const lateProfile = await sql(`select is_pro from profiles where id='${userId}'`);
check("renovação atrasada não reativa o Pro", (await late.json()).status === 200 && lateProfile[0].is_pro === false, lateProfile);

// Evento sem assinatura conhecida fica guardado e não muda nada.
const orphan = await fetch(`${BACKEND}/__webhook`, {
  method: "POST",
  body: JSON.stringify({ event: "subscription.completed", data: { subscription: { id: "subs_desconhecida" } } }),
});
const stored = await sql(`select count(*)::int as n from payment_events where processed_at is null`);
check("webhook sem casamento é guardado", (await orphan.json()).status === 200 && stored[0].n === 1, stored);

const forged = await fetch(`${APP}/api/webhooks/abacatepay?webhookSecret=errado`, { method: "POST", body: "{}" });
check("webhook sem segredo é recusado", forged.status === 401, forged.status);

// ---- Pro liberado pelo admin
await admin.goto(`${APP}/admin?status=activated`);
const joaoRow = admin.getByRole("listitem").filter({ hasText: "João Pedro" });
await joaoRow.getByRole("button", { name: "Liberar Pro" }).click();
await joaoRow.getByRole("button", { name: "Tirar Pro" }).waitFor();
await user.goto(`${APP}/pro`);
await user.getByText("Seu Pro foi liberado pela equipe.").waitFor();
check("Pro de demonstração não mostra cancelar", (await user.getByRole("button", { name: "Cancelar assinatura" }).count()) === 0);
await joaoRow.getByRole("button", { name: "Tirar Pro" }).click();
await joaoRow.getByRole("button", { name: "Liberar Pro" }).waitFor();

// ---- próprio perfil e edição
await user.goto(`${APP}/perfil`);
await user.waitForURL(`**/perfil/${userId}`);
await user.getByRole("heading", { name: /Jota/ }).waitFor();
await user.waitForTimeout(500);
await shot(user, "22-perfil-proprio");
const playing = await user.locator("video").evaluate((video) => !video.paused && video.muted && video.loop);
check("vídeo toca em loop e mudo", playing);

await user.getByRole("link", { name: "Editar perfil" }).click();
await user.waitForURL("**/perfil/editar");
await user.getByLabel("Apelido").waitFor();
check("edição traz o WhatsApp salvo", (await user.getByLabel("WhatsApp").inputValue()) === "(11) 98765-4321");
await shot(user, "23-editar");

await user.getByRole("button", { name: "Remover foto 1" }).click();
await user.getByLabel("Apelido").fill("Jotinha");
await user.getByRole("button", { name: "Salvar" }).click();
await user.waitForURL(`**/perfil/${userId}`);
await user.getByRole("heading", { name: /Jotinha/ }).waitFor();
const filesAfter = (await (await fetch(`${BACKEND}/__files`)).json()).filter((key) => key.includes(userId));
check("foto removida sai do Storage", filesAfter.length === 1 && filesAfter[0].endsWith(".webm"), filesAfter);

// ---- permissões
const notAdmin = await userContext.newPage();
await notAdmin.goto(`${APP}/admin`);
await notAdmin.waitForURL("**/inicio");
check("usuário comum não entra no admin", notAdmin.url().endsWith("/inicio"));
await notAdmin.close();

const missing = await userContext.newPage();
await missing.goto(`${APP}/perfil/00000000-0000-4000-8000-000000000999`);
await missing.getByText("Não encontramos essa página").waitFor();
await missing.close();
check("perfil inexistente cai no not-found", true);

const anonymous = await browser.newContext(mobile);
const anonymousPage = await anonymous.newPage();
for (const route of ["/inicio", "/matches", "/pro", "/perfil", `/perfil/${userId}`, "/perfil/editar"]) {
  await anonymousPage.goto(`${APP}${route}`);
  await anonymousPage.waitForURL("**/entrar**");
  check(`anônimo em ${route} vai para o login`, true);
}
await anonymous.close();

// ---- PWA
const manifest = await (await fetch(`${APP}/manifest.webmanifest`)).json();
check("manifest com ícones", manifest.icons.length === 3 && manifest.display === "standalone", manifest);
for (const { src } of manifest.icons) {
  const response = await fetch(`${APP}${src}`);
  check(`ícone ${src}`, response.ok && response.headers.get("content-type") === "image/png");
}

await user.goto(`${APP}/inicio`);
await user.evaluate(() => navigator.serviceWorker.ready);
await user.reload();
await user.waitForLoadState("networkidle");
check("service worker controla a página", await user.evaluate(() => Boolean(navigator.serviceWorker.controller)));

const cacheKeys = await user.evaluate(async () => {
  const names = await caches.keys();
  const urls = [];
  for (const name of names) {
    const cache = await caches.open(name);
    urls.push(...(await cache.keys()).map((request) => new URL(request.url).pathname));
  }
  return urls;
});
const cachedPages = cacheKeys.filter((key) => !key.startsWith("/_next/static/") && !key.startsWith("/icons/"));
check("só a tela offline fica no cache como página", cachedPages.length === 1 && cachedPages[0] === "/offline", cachedPages);

await userContext.setOffline(true);
await user.goto(`${APP}/matches`).catch(() => {});
await user.getByText("Você está sem conexão").waitFor();
await user.waitForTimeout(300);
await shot(user, "24-offline");
check("sem internet aparece a tela offline", true);
await userContext.setOffline(false);

// ---- sair
await user.goto(`${APP}/perfil/editar`);
await user.getByRole("button", { name: "Sair" }).click();
await user.waitForURL("**/entrar");
await user.goto(`${APP}/inicio`);
await user.waitForURL("**/entrar**");
check("sair encerra a sessão", true);

await user.getByLabel("E-mail").fill(EMAIL);
await user.getByLabel("Senha").fill(PASSWORD);
await user.getByRole("button", { name: "Entrar" }).click();
await user.waitForURL("**/inicio");
check("login com e-mail e senha volta para a home", true);

// ---- admin entra no app
await admin.goto(`${APP}/admin`);
await admin.getByRole("button", { name: "Ir para o app" }).click();
await admin.waitForURL("**/perfil/editar");
check("admin sem perfil cai no onboarding", admin.url().endsWith("/perfil/editar"));
await admin.getByLabel("Apelido").waitFor();
check("nome do admin vem do e-mail", (await admin.getByLabel("Nome").inputValue()) === "admin");

await admin.locator('input[accept="image/*"]').first().setInputFiles(photoPath);
await admin.locator('input[name="photo_paths"]').first().waitFor({ state: "attached" });
await admin.getByLabel("Nome").fill("Dono do App");
await admin.getByLabel("Apelido").fill("Dono");
await admin.getByLabel("Bio").fill("Testando o app.");
await admin.getByText("Homem", { exact: true }).click();
await admin.getByLabel("Data de nascimento").fill("1995-05-05");
await admin.getByLabel("WhatsApp").fill("11955554444");
await admin.getByRole("button", { name: "Concluir perfil" }).click();
await admin.waitForURL("**/inicio");
check("admin conclui o onboarding e vê a home", admin.url().endsWith("/inicio"));

const adminContact = await sql("select c.whatsapp, p.onboarded_at is not null as ok from profile_contacts c join profiles p on p.id = c.user_id where p.nickname = 'Dono'");
check("WhatsApp do admin foi salvo", adminContact[0]?.whatsapp === "5511955554444" && adminContact[0]?.ok === true, adminContact);

await admin.goto(`${APP}/perfil/editar`);
await admin.getByLabel("WhatsApp").fill("11955553333");
await admin.getByRole("button", { name: "Salvar" }).click();
await admin.waitForURL(/\/perfil\/[0-9a-f-]{36}$/);
const updatedContact = await sql("select c.whatsapp from profile_contacts c join profiles p on p.id = c.user_id where p.nickname = 'Dono'");
check("editar atualiza o WhatsApp existente", updatedContact[0]?.whatsapp === "5511955553333", updatedContact);

await admin.goto(`${APP}/admin`);
await admin.getByRole("button", { name: "Ir para o app" }).waitFor();
check("admin com perfil continua abrindo o painel", admin.url().endsWith("/admin"));
await shot(admin, "27-admin-botao");
await admin.getByRole("button", { name: "Ir para o app" }).click();
await admin.waitForURL("**/inicio");
const nameKept = await sql("select name from profiles where nickname = 'Dono'");
check("segundo clique não mexe no perfil", nameKept[0]?.name === "Dono do App", nameKept);

// ---- stories
// O story fecha sozinho em 5 segundos, e numa máquina carregada isso corre contra os cliques
// do teste. A barra fica parada nos passos de interação e é liberada no teste do fechamento.
const FREEZE_ID = "freeze-stories";
async function freezeStories(context) {
  await context.addInitScript((id) => {
    addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = ".animate-story-progress { animation-play-state: paused !important; }";
      document.head.append(style);
    });
  }, FREEZE_ID);
}

await freezeStories(userContext);

const members = {};
async function createMember(key, nickname, gender, pro) {
  const email = `${key}.${stamp}@exemplo.com`;
  const created = await fetch(`${BACKEND}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  }).then((response) => response.json());

  await sql(`insert into public.profiles (id, name, nickname, bio, gender, birth_date, photo_paths, is_pro)
    values ('${created.id}', '${nickname}', '${nickname}', 'Bio', '${gender}', '1996-04-04', array['${created.id}/a.jpg'], ${pro})`);
  await sql(`insert into public.profile_contacts (user_id, whatsapp) values ('${created.id}', '5511977776666')`);

  const context = await browser.newContext(mobile);
  await freezeStories(context);
  const page = await context.newPage();
  watch(page, key);
  await page.goto(`${APP}/entrar`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio");
  members[key] = { id: created.id, page, context };
  return members[key];
}

const storyRow = user.getByRole("list", { name: "Stories" });
const storyInput = storyRow.getByLabel("Postar story");
const ownStoryButton = user.getByRole("button", { name: "Ver seu story" });
const ownViewer = user.getByRole("dialog", { name: /^Story de/ });
const countRows = async (query) => (await sql(`select count(*)::int as n from ${query}`))[0].n;

// A tela responde antes de a gravação terminar: espera o banco em vez de chutar um tempo.
async function waitForRows(query, expected) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if ((await countRows(query)) === expected) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

await user.goto(`${APP}/inicio`);
await storyInput.setInputFiles(photoPath);
await ownStoryButton.waitFor();
check("free posta o story do dia", (await countRows(`stories where user_id='${userId}'`)) === 1);
check("free não vê como postar o segundo", (await storyInput.count()) === 0);
await shot(user, "30-story-postado");

await ownStoryButton.click();
await ownViewer.getByRole("button", { name: /Visto por 0/ }).waitFor();
check("dono abre o próprio story", await ownViewer.locator("img").first().isVisible());
check("free vê o aviso do limite", await ownViewer.getByText("1 story por dia").isVisible());
await shot(user, "31-story-proprio");
await user.keyboard.press("Escape");
await ownViewer.waitFor({ state: "hidden" });

const { page: lia } = await createMember("lia", "Lia", "female", false);
const storyPath = (await sql(`select media_path from stories where user_id='${userId}'`))[0].media_path;
await lia.getByRole("button", { name: "Story de Jotinha, recurso Pro" }).click();
await lia.getByText("Stories são do Pro").waitFor();
check("free não abre story de outra pessoa", (await lia.getByRole("dialog", { name: "Story de Jotinha" }).count()) === 0);
check("a mídia do story não chega a quem é free", !(await lia.content()).includes(storyPath));

const { page: bia } = await createMember("bia", "Bia", "female", true);
const biaViewer = bia.getByRole("dialog", { name: "Story de Jotinha" });
await bia.getByRole("button", { name: "Ver story de Jotinha" }).click();
await biaViewer.getByRole("button", { name: "Curtir story" }).click();
await biaViewer.getByRole("button", { name: "Descurtir story" }).waitFor();
await bia.waitForTimeout(400);
await shot(bia, "32-story-pro");
await bia.keyboard.press("Escape");
check("abrir o story conta a visualização", await waitForRows("story_views", 1));
check("curtir o story é gravado", await waitForRows("story_likes", 1));

await bia.reload();
await bia.getByRole("button", { name: "Ver story de Jotinha" }).click();
await biaViewer.getByRole("button", { name: "Descurtir story" }).waitFor();
check("story curtido continua curtido", true);
check("rever não conta duas visualizações", (await countRows("story_views")) === 1);
await bia.keyboard.press("Escape");

await user.reload();
await ownStoryButton.click();
await ownViewer.getByRole("button", { name: "Visto por 1 · 1 curtida" }).click();
await ownViewer.getByText("Bia", { exact: true }).waitFor();
check("dono vê quem viu", true);
check("dono vê quem curtiu", (await ownViewer.getByLabel("Curtiu").count()) === 1);
await shot(user, "33-quem-viu");
await user.evaluate((id) => document.getElementById(id)?.remove(), FREEZE_ID);
await user.waitForTimeout(5500);
check("a lista pausa o story", await ownViewer.isVisible());
await user.keyboard.press("Escape");
await ownViewer.waitFor({ state: "hidden" });

await sql(`update stories set created_at = now() - interval '25 hours' where user_id='${userId}'`);
await user.reload();
await storyInput.waitFor({ state: "attached" });
check("depois de 24 horas o story sai do ar", (await ownStoryButton.count()) === 0);
await storyInput.setInputFiles(videoPath);
await ownStoryButton.waitFor();
const storyRows = await sql(`select media_type from stories where user_id='${userId}'`);
check("postar limpa o story vencido", storyRows.length === 1 && storyRows[0].media_type === "video", storyRows);
const storyFiles = await (await fetch(`${BACKEND}/__files`)).json();
check("o arquivo vencido sai do Storage", !storyFiles.some((key) => key.endsWith(storyPath)), storyPath);

await ownStoryButton.click();
await ownViewer.locator("video").waitFor();
const storyVideo = await ownViewer.locator("video").evaluate((video) => ({ muted: video.muted, loop: video.loop }));
check("story em vídeo abre mudo", storyVideo.muted, storyVideo);
await user.keyboard.press("Escape");
await ownViewer.waitFor({ state: "hidden" });

await user.evaluate((id) => document.getElementById(id)?.remove(), FREEZE_ID);
await ownStoryButton.click();
await ownViewer.waitFor();
await ownViewer.waitFor({ state: "hidden", timeout: 15000 });
check("story fecha sozinho no fim", true);

// ---- métricas
await bia.goto(`${APP}/perfil/${userId}`);
await bia.getByRole("heading", { name: /Jotinha/ }).waitFor();
await bia.reload();
await bia.getByRole("heading", { name: /Jotinha/ }).waitFor();
check("visita ao perfil conta uma vez por dia", (await countRows(`profile_views where profile_id='${userId}'`)) === 1);

await user.goto(`${APP}/perfil/${userId}`);
const lockedStats = user.getByRole("link", { name: /visitas e curtidas/ });
await lockedStats.waitFor();
check("free vê as métricas bloqueadas", (await user.getByRole("region", { name: "Métricas do perfil" }).count()) === 0);
check("visitar o próprio perfil não conta", (await countRows(`profile_views where profile_id='${userId}' and viewer_id='${userId}'`)) === 0);

await user.goto(`${APP}/curtidas`);
await user.waitForURL("**/pro");
check("free não abre quem curtiu", user.url().endsWith("/pro"));

await sql(`update profiles set is_pro = true where id='${userId}'`);
await user.goto(`${APP}/perfil/${userId}`);
const statsCard = user.getByRole("region", { name: "Métricas do perfil" });
await statsCard.waitFor();
await shot(user, "34-metricas");
const likesReceived = await countRows(`swipes where target_id='${userId}' and action='like'`);
const statsText = await statsCard.innerText();
check("Pro vê as visitas", /1\s*Visitas ao perfil/.test(statsText), statsText);
check("Pro vê as curtidas", new RegExp(`${likesReceived}\\s*Curtidas`).test(statsText), { statsText, likesReceived });

await statsCard.getByRole("link").click();
await user.waitForURL("**/curtidas");
await user.getByRole("heading", { name: "Quem te curtiu" }).waitFor();
// A rota anterior fica oculta no DOM, e só os links visíveis são da tela atual.
const likerLinks = user.locator('main a[href^="/perfil/"]:visible');
await likerLinks.first().waitFor();
check("Pro vê quem curtiu", (await likerLinks.count()) === likesReceived, { likesReceived });
await shot(user, "35-quem-curtiu");
await sql(`update profiles set is_pro = false where id='${userId}'`);

for (const { context } of Object.values(members)) await context.close();

// ---- outras telas
{
  const iphone = await browser.newContext({
    ...mobile,
    viewport: { width: 375, height: 667 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const page = await iphone.newPage();
  await page.goto(`${APP}/entrar`);
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio");
  await sql(`delete from swipes where swiper_id='${userId}'`);
  await page.reload();
  await page.getByRole("button", { name: "Curtir" }).waitFor();
  await page.waitForTimeout(600);
  await shot(page, "25-iphone-pequeno");
  const instructions = page.getByText("Para instalar, toque em Compartilhar");
  check("iOS mostra como instalar", await instructions.isVisible());
  await page.getByRole("button", { name: "Dispensar" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Curtir" }).waitFor();
  await page.waitForTimeout(400);
  check("aviso dispensado não volta", !(await instructions.isVisible()));
  await iphone.close();

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "pt-BR" });
  const site = await desktop.newPage();
  watch(site, "desktop");
  await site.goto(APP);
  await site.waitForLoadState("networkidle");
  await shot(site, "26-lp-desktop");
  await desktop.close();
}

await browser.close();

console.log("\nProblemas de console:");
for (const problem of [...new Set(problems)]) console.log(" -", problem);
console.log(failures === 0 ? "\nFluxo inteiro passou." : `\n${failures} falha(s).`);
process.exit(failures === 0 ? 0 : 1);
