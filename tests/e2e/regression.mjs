// Regressão de ponta a ponta. Rode com `npm run test:e2e`, que sobe tudo isto antes.
import { execSync } from "node:child_process";
import { createECDH, randomBytes } from "node:crypto";
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
await user.getByLabel("Estado").selectOption("SP");
await user.getByLabel("Cidade").fill("São Paulo");
await user.getByLabel("Bairro").fill("Vila Mariana");
await user.getByLabel("Altura (cm)").fill("178");
await user.locator('select[name="church"]').selectOption("batista");
await user.locator('select[name="skin_color"]').selectOption("parda");
await user.getByRole("button", { name: "Praia", exact: true }).click();
await user.getByRole("button", { name: "Café", exact: true }).click();
await user.getByLabel("Emoji do gosto").fill("ab");
await user.getByLabel("Nome do gosto").fill("Quebra-cabeça");
await user.getByRole("button", { name: "Adicionar gosto" }).click();
await user.getByText("Use um emoji só.").waitFor();
check("gosto sem emoji é recusado", (await user.getByRole("button", { name: "Remover Quebra-cabeça" }).count()) === 0);
await user.getByLabel("Emoji do gosto").fill("🧩");
await user.getByRole("button", { name: "Adicionar gosto" }).click();
await user.getByRole("button", { name: "Remover Quebra-cabeça" }).waitFor();
check("com 3 gostos as sugestões travam", await user.getByRole("button", { name: "Trilha", exact: true }).isDisabled());
await user.getByLabel("WhatsApp").fill("11987654321");
await shot(user, "08-onboarding-preenchido");

await user.getByRole("button", { name: "Concluir perfil" }).click();
await user.getByText("O app é só para maiores de 18 anos.").waitFor();
check("menor de idade é barrado", true);
check("erro mantém a bio", (await user.getByLabel("Bio").inputValue()).startsWith("Louvor"));
check("erro mantém a mídia", (await user.locator('input[name="photo_paths"]').count()) === 1);
check("erro mantém os gostos", (await user.locator('input[name="hobbies"]').inputValue()).includes("Quebra-cabeça"));
check("erro mantém a cidade", (await user.getByLabel("Cidade").inputValue()) === "São Paulo");

await user.getByLabel("Data de nascimento").fill("2000-01-01");
await user.getByRole("button", { name: "Concluir perfil" }).click();
await user.waitForURL("**/inicio");
check("perfil completo libera a home", user.url().endsWith("/inicio"));

const savedProfile = (await sql(`select state, city, neighborhood, hobbies, height_cm, church, skin_color from profiles where id='${userId}'`))[0];
check(
  "localização e gostos são salvos",
  savedProfile.state === "SP" && savedProfile.city === "São Paulo" && savedProfile.neighborhood === "Vila Mariana" && savedProfile.hobbies.length === 3,
  savedProfile,
);
check(
  "altura, igreja e cor são salvas",
  savedProfile.height_cm === 178 && savedProfile.church === "batista" && savedProfile.skin_color === "parda",
  savedProfile,
);

// Sem o U+FE0F e com a cidade em outra grafia: o que o usuário escolheu precisa casar mesmo assim.
// Vem antes do seed: o execSync trava o Node, e o fetch seguinte pegaria uma conexão já fechada.
await sql(`update profiles set state='SP', city='sao  paulo', church='batista', hobbies='[{"emoji":"\u{1F3D6}","hobbie":"Praia"},{"emoji":"🎯","hobbie":"Dardos"}]' where gender='female'`);

// Metade dos perfis de exemplo curte o usuário novo.
execSync("npx tsx scripts/seed-demo.ts", { cwd: projectRoot, env: process.env, stdio: "pipe" });
await user.reload();

// ---- home
await user.getByRole("button", { name: "Curtir" }).waitFor();
await user.waitForTimeout(600);
await shot(user, "09-home");
const cardCommonMark = user.getByRole("article").getByText("em comum");
const cardOtherHobby = user.getByRole("article").getByText("Dardos");
check("card mostra todos os gostos", await cardOtherHobby.isVisible());
const commonTags = await cardCommonMark.evaluateAll((marks) => marks.map((mark) => mark.parentElement.textContent));
check("card destaca a igreja e o gosto em comum", commonTags.length === 2 && commonTags.some((tag) => tag.includes("Batista")) && commonTags.some((tag) => tag.includes("Praia")), commonTags);
check("gosto diferente fica sem destaque", !(await cardOtherHobby.evaluate((tag) => tag.className)).includes("bg-coral"));
check("card mostra a mesma região", await user.getByRole("article").getByText("Da sua região").isVisible());
const cardPlace = await user.getByRole("article").getByText(/, sao\s+paulo - SP$/).textContent();
check("card mostra bairro, cidade e estado", cardPlace.split(",")[0].length > 0, cardPlace);
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
  if (matches === 1) {
    await user.waitForTimeout(1400);
    await shot(user, "12-match");
    check("match mostra o que há em comum", (await overlay.getByText("em comum").count()) === 2);
    check("match leva para a conversa", (await overlay.getByRole("link", { name: "Abrir conversa" }).getAttribute("href")).startsWith("/conversas/"));
    // O coração pulsa sem parar, e o Playwright só clica sozinho no que está parado.
    await overlay.getByRole("button", { name: "Soltar corações" }).click({ force: true });
    await user.waitForTimeout(300);
    await shot(user, "12-match-coracoes");
    await overlay.getByRole("button", { name: "Mandar mensagem no WhatsApp" }).click();
    const matchPaywall = user.getByRole("dialog", { name: "WhatsApp é do Pro" });
    await matchPaywall.waitFor();
    await user.waitForTimeout(400);
    await shot(user, "12-match-paywall");
    check("no match, quem não é Pro conhece o plano", true);
    await matchPaywall.getByRole("button", { name: "Fechar" }).click();
    await matchPaywall.waitFor({ state: "hidden" });
  }
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
await user.locator('main a[href^="/conversas/"]').first().waitFor();
await shot(user, "14-matches");

await user.locator('main a[href^="/conversas/"]').first().click();
await user.waitForURL(/\/conversas\/[0-9a-f-]{36}$/);
await user.getByText(/Diga oi para/).waitFor();
check("conversa nova convida a dizer oi", true);
await user.getByRole("link", { name: /^Ver perfil de/ }).click();
await user.waitForURL(/\/perfil\/[0-9a-f-]{36}$/);
await user.getByRole("link", { name: "Abrir conversa" }).waitFor();
check("perfil de quem deu match leva para a conversa", true);
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
await user.waitForLoadState("networkidle");
await user.locator('main a[href^="/conversas/"]').first().click();
await user.waitForURL(/\/conversas\/[0-9a-f-]{36}$/);
await user.getByRole("link", { name: /^Ver perfil de/ }).click();
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
check("nome do admin vem do e-mail", (await admin.getByLabel("Nome", { exact: true }).inputValue()) === "admin");

await admin.locator('input[accept="image/*"]').first().setInputFiles(photoPath);
await admin.locator('input[name="photo_paths"]').first().waitFor({ state: "attached" });
await admin.getByLabel("Nome", { exact: true }).fill("Dono do App");
await admin.getByLabel("Apelido").fill("Dono");
await admin.getByLabel("Bio").fill("Testando o app.");
await admin.getByText("Homem", { exact: true }).click();
await admin.getByLabel("Data de nascimento").fill("1995-05-05");
await admin.getByLabel("Estado").selectOption("RJ");
await admin.getByLabel("Cidade").fill("Niterói");
await admin.getByLabel("Bairro").fill("Icaraí");
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

  // Sem GPU, cada aba com o fundo animado disputa a CPU, e os cliques chegam com segundos de atraso.
  const context = await browser.newContext({ ...mobile, reducedMotion: "reduce" });
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

// Sem esperar, o clique pode chegar antes da hidratação e se perder.
await bia.reload();
await bia.waitForLoadState("networkidle");
await bia.getByRole("button", { name: "Ver story de Jotinha" }).click();
await biaViewer.getByRole("button", { name: "Descurtir story" }).waitFor();
check("story curtido continua curtido", true);
check("rever não conta duas visualizações", (await countRows("story_views")) === 1);
await bia.keyboard.press("Escape");

await user.reload();
await user.waitForLoadState("networkidle");
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
// O vídeo dura 2 segundos: esperar o clique terminar para só então olhar perde o story aberto.
await Promise.all([ownViewer.waitFor(), ownStoryButton.click()]);
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

// Quem é Pro chama direto do match.
await sql(`delete from swipes where swiper_id='${userId}'`);
await sql(`insert into swipes (swiper_id, target_id, action)
  select id, '${userId}', 'like' from profiles where gender='female'
  on conflict (swiper_id, target_id) do update set action='like'`);
await user.goto(`${APP}/inicio`);
await user.waitForLoadState("networkidle");
await user.getByRole("button", { name: "Curtir" }).click();
const proMatch = user.getByRole("dialog", { name: "Deu match!" });
await proMatch.waitFor();
await user.waitForTimeout(1400);
await shot(user, "36-match-pro");
const matchHref = await proMatch.getByRole("link", { name: "Mandar mensagem no WhatsApp" }).getAttribute("href");
check("Pro chama no WhatsApp direto do match", matchHref?.startsWith("https://wa.me/55") && decodeURIComponent(matchHref).includes("Deu match"), matchHref);
await proMatch.getByRole("button", { name: "Continuar" }).click();
await proMatch.waitFor({ state: "hidden" });

await sql(`update profiles set is_pro = false where id='${userId}'`);

// ---- chat
{
  const biaId = members.bia.id;
  await sql(`insert into swipes (swiper_id, target_id, action) values ('${userId}', '${biaId}', 'like'), ('${biaId}', '${userId}', 'like')
    on conflict (swiper_id, target_id) do update set action = 'like'`);

  // Chaves de verdade: sem elas, a mensagem não é cifrada e nada sai para o serviço de push.
  const device = createECDH("prime256v1");
  device.generateKeys();
  await sql(`insert into push_subscriptions (endpoint, user_id, p256dh, auth) values
    ('${BACKEND}/__push/bia', '${biaId}', '${device.getPublicKey("base64url")}', '${randomBytes(16).toString("base64url")}')`);

  await user.goto(`${APP}/conversas/${biaId}`);
  await user.waitForLoadState("networkidle");
  await user.getByLabel("Mensagem").fill("Oi, Bia! Tudo bem?");
  await user.getByRole("button", { name: "Enviar" }).click();
  await user.getByText("Oi, Bia! Tudo bem?").waitFor();
  check("quem manda vê a mensagem", true);
  await user.getByRole("img", { name: "Enviada" }).waitFor();
  check("mensagem começa como enviada", true);

  let pushes = [];
  for (let attempt = 0; attempt < 40 && pushes.length === 0; attempt += 1) {
    pushes = await (await fetch(`${BACKEND}/__pushes`)).json();
    if (pushes.length === 0) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  check("mensagem dispara a notificação cifrada", pushes.length === 1 && pushes[0].encoding === "aes128gcm" && pushes[0].scheme === "vapid" && pushes[0].bytes > 0, pushes);

  await bia.goto(`${APP}/matches`);
  await bia.getByLabel("1 não lidas").waitFor();
  check("lista mostra a mensagem não lida", await bia.getByText("Oi, Bia! Tudo bem?").isVisible());
  check("menu avisa que há mensagem nova", (await bia.getByLabel("1 mensagens não lidas").count()) === 1);
  await bia.waitForLoadState("networkidle");
  await bia.locator(`main a[href="/conversas/${userId}"]`).click();
  await bia.getByRole("list", { name: "Mensagens" }).getByText("Oi, Bia! Tudo bem?").waitFor();
  check("quem recebe lê a mensagem", true);

  await user.getByRole("img", { name: "Visualizada" }).waitFor({ timeout: 10000 });
  await shot(user, "40-chat");
  check("quem manda vê que foi visualizada", true);

  await bia.getByLabel("Mensagem", { exact: true }).fill("Tudo ótimo!");
  await bia.getByRole("button", { name: "Enviar" }).click();
  await user.getByRole("list", { name: "Mensagens" }).getByText("Tudo ótimo!").waitFor({ timeout: 10000 });
  check("resposta chega sem recarregar a página", true);

  const { page: outsider } = members.lia;
  await outsider.goto(`${APP}/conversas/${userId}`);
  await outsider.getByText("Não encontramos essa página").waitFor();
  check("sem match não abre a conversa", true);
}

// ---- eventos
{
  await user.goto(`${APP}/eventos`);
  await user.getByRole("heading", { name: "Eventos" }).waitFor();
  await user.waitForLoadState("networkidle");
  await user.getByRole("link", { name: "Criar" }).click();
  await user.waitForURL("**/eventos/novo");
  await user.getByLabel("Nome do evento").waitFor();
  check("evento já sugere quem organiza", (await user.getByLabel("Organizado por").inputValue()) === "Jotinha");

  await user.locator('input[accept="image/*"]').first().setInputFiles(photoPath);
  await user.locator('input[name="photo_paths"]').waitFor({ state: "attached" });
  await user.getByLabel("Nome do evento").fill("Retiro de jovens");
  await user.getByLabel("Descrição").fill("Dois dias de louvor, conversa e fogueira.");
  await user.getByLabel("Local").fill("Sítio Betel, Atibaia");
  await user.getByLabel("Data e hora").fill("2020-05-10T19:30");
  await user.getByRole("button", { name: "Criar evento" }).click();
  await user.getByText("Escolha uma data no futuro.").waitFor();
  check("evento no passado é recusado", (await user.getByLabel("Nome do evento").inputValue()) === "Retiro de jovens");

  await user.getByLabel("Data e hora").fill("2040-05-10T19:30");
  await user.getByRole("button", { name: "Criar evento" }).click();
  await user.waitForURL(/\/eventos\/[0-9a-f-]{36}$/);
  await user.getByRole("heading", { name: "Retiro de jovens" }).waitFor();
  const eventId = user.url().split("/").pop();
  check("quem cria já aparece confirmado", await user.getByRole("heading", { name: "1 confirmado" }).isVisible());
  check("evento mostra o horário de Brasília", await user.getByText(/19:30/).isVisible());
  await user.waitForTimeout(400);
  await shot(user, "41-evento");

  await bia.goto(`${APP}/eventos`);
  await bia.getByText("Retiro de jovens").waitFor();
  await shot(bia, "42-eventos");
  check("todo mundo vê o evento", true);
  await bia.goto(`${APP}/eventos/${eventId}`);
  await bia.waitForLoadState("networkidle");
  check("só quem criou vê o botão de editar", (await bia.getByRole("link", { name: "Editar" }).count()) === 0);
  await bia.getByRole("button", { name: "Confirmar presença" }).click();
  await bia.getByRole("heading", { name: "2 confirmados" }).waitFor();
  await bia.getByRole("button", { name: "Cancelar presença" }).waitFor();
  check("confirmar presença atualiza a lista", await bia.getByRole("link", { name: "Bia" }).isVisible());
  await bia.goto(`${APP}/eventos/${eventId}/editar`);
  await bia.getByText("Não encontramos essa página").waitFor();
  check("quem não criou não abre a edição", true);

  await user.goto(`${APP}/eventos/${eventId}/editar`);
  await user.getByLabel("Nome do evento").waitFor();
  check("edição mantém o horário", (await user.getByLabel("Data e hora").inputValue()) === "2040-05-10T19:30");
  await user.getByLabel("Nome do evento").fill("Retiro de primavera");
  await user.getByRole("button", { name: "Salvar evento" }).click();
  await user.waitForURL(new RegExp(`/eventos/${eventId}$`));
  await user.getByRole("heading", { name: "Retiro de primavera" }).waitFor();
  check("dono edita o evento", true);

  const eventFile = (await sql(`select photo_paths[1] as path from events where id='${eventId}'`))[0].path;
  await user.waitForLoadState("networkidle");
  await user.getByRole("button", { name: "Excluir" }).click();
  await user.getByRole("button", { name: "Excluir de vez" }).click();
  await user.waitForURL("**/eventos");
  await user.getByRole("heading", { name: "Eventos" }).waitFor();
  check("dono exclui o evento", (await countRows(`events where id='${eventId}'`)) === 0);
  const filesLeft = await (await fetch(`${BACKEND}/__files`)).json();
  check("foto do evento sai do Storage", !filesLeft.some((key) => key.endsWith(eventFile)), eventFile);
}

// ---- preferências
{
  await sql(`update profiles set church = 'catolica' where nickname = 'Aninha'`);
  await sql(`delete from swipes where swiper_id = '${userId}'`);
  await user.goto(`${APP}/perfil/editar`);
  await user.getByRole("group", { name: "Igreja que você quer ver" }).getByRole("button", { name: "Católica" }).click();
  await user.getByRole("group", { name: "Cor da pele que você quer ver" }).getByRole("button", { name: "Parda" }).click();
  await user.getByRole("heading", { name: "Quem você quer ver" }).scrollIntoViewIfNeeded();
  await shot(user, "43-preferencias");
  await user.getByRole("button", { name: "Salvar" }).click();
  await user.waitForURL(/\/perfil\/[0-9a-f-]{36}$/);
  const prefs = (await sql(`select pref_churches, pref_skin_colors from profiles where id='${userId}'`))[0];
  check("preferências são salvas", prefs.pref_churches.join() === "catolica" && prefs.pref_skin_colors.join() === "parda", prefs);

  await sql(`update profiles set skin_color = 'parda' where nickname = 'Aninha'`);
  await user.goto(`${APP}/inicio`);
  await user.getByRole("article").waitFor();
  check("deck mostra só quem combina", (await user.getByRole("article").getAttribute("aria-label")).startsWith("Aninha"));

  await sql(`update profiles set pref_churches = '{}', pref_skin_colors = '{}' where id='${userId}'`);
}

for (const { context } of Object.values(members)) await context.close();

// ---- outras telas
{
  const iphone = await browser.newContext({
    ...mobile,
    viewport: { width: 375, height: 667 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const INSTALL_GUIDE = "Adicione o app à tela inicial";
  const logIn = async (target) => {
    await target.getByLabel("E-mail").fill(EMAIL);
    await target.getByLabel("Senha").fill(PASSWORD);
    await target.getByRole("button", { name: "Entrar" }).click();
    await target.waitForURL("**/inicio");
  };

  const page = await iphone.newPage();
  await page.goto(`${APP}/entrar`);
  await logIn(page);
  const guide = page.getByRole("dialog", { name: INSTALL_GUIDE });
  await guide.waitFor();
  await page.waitForTimeout(600);
  await shot(page, "25-guia-iphone");
  check("iOS ensina a instalar logo depois do login", await guide.getByText("Adicionar à Tela de Início").isVisible());
  const dismiss = guide.getByRole("button", { name: "Agora não" });
  const dismissBox = await dismiss.boundingBox();
  check("guia cabe no iPhone pequeno", dismissBox.y + dismissBox.height <= 667, dismissBox);

  await dismiss.click();
  await guide.waitFor({ state: "hidden" });
  await sql(`delete from swipes where swiper_id='${userId}'`);
  await page.reload();
  await page.getByRole("button", { name: "Curtir" }).waitFor();
  await page.waitForTimeout(600);
  await shot(page, "25-iphone-pequeno");
  check("guia dispensado não volta", !(await guide.isVisible()));

  const dismissedDaysAgo = (days) =>
    page.evaluate(
      (at) => localStorage.setItem("install-guide-dismissed", String(at)),
      Date.now() - days * 24 * 60 * 60 * 1000,
    );
  await dismissedDaysAgo(2);
  await page.reload();
  await page.getByRole("button", { name: "Curtir" }).waitFor();
  await page.waitForTimeout(400);
  check("guia respeita o intervalo do lembrete", !(await guide.isVisible()));
  await dismissedDaysAgo(4);
  await page.reload();
  await guide.waitFor();
  check("guia volta depois do intervalo", true);
  await dismiss.click();
  await guide.waitFor({ state: "hidden" });

  await page.goto(`${APP}/perfil/editar`);
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL("**/entrar");
  await logIn(page);
  await guide.waitFor();
  check("guia volta no login seguinte", true);

  const installed = await iphone.newPage();
  await installed.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
  await installed.goto(`${APP}/inicio`);
  await installed.getByRole("button", { name: "Curtir" }).waitFor();
  await installed.waitForTimeout(400);
  check(
    "com o app instalado o guia não aparece",
    !(await installed.getByRole("dialog", { name: INSTALL_GUIDE }).isVisible()),
  );
  const accountMarked = async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const [profile] = await sql(`select app_installed_at from profiles where id='${userId}'`);
      if (profile.app_installed_at) return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  };
  check("abrir o app instalado marca a conta", await accountMarked());

  // Sem a dispensa no storage, só a marca da conta segura o guia, como no Safari do iPhone.
  await page.evaluate(() => localStorage.removeItem("install-guide-dismissed"));
  await page.reload();
  await page.getByRole("button", { name: "Curtir" }).waitFor();
  await page.waitForTimeout(400);
  check("depois de instalar o navegador não lembra mais", !(await guide.isVisible()));
  await iphone.close();
  await sql(`update profiles set app_installed_at = null where id='${userId}'`);

  const android = await browser.newContext({
    ...mobile,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  });
  const droid = await android.newPage();
  watch(droid, "android");
  await droid.goto(`${APP}/entrar`);
  await droid.waitForLoadState("networkidle");
  // O Chrome dispara o evento antes do login, e o login não recarrega a página.
  await droid.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = async () => {
      window.installPrompted = true;
    };
    window.dispatchEvent(event);
  });
  await logIn(droid);
  const droidGuide = droid.getByRole("dialog", { name: INSTALL_GUIDE });
  await droidGuide.waitFor();
  await droid.waitForTimeout(600);
  await shot(droid, "27-guia-android");
  await droidGuide.getByRole("button", { name: "Instalar agora" }).click();
  await droidGuide.waitFor({ state: "hidden" });
  check("Android instala em um toque depois do login", await droid.evaluate(() => window.installPrompted === true));

  // Sem o evento, como no Firefox, sobra o caminho pelo menu do navegador.
  // Quem fechou o banner antigo ainda tem a chave dele, e isso não pode esconder o guia.
  await droid.evaluate(() => {
    localStorage.removeItem("install-guide-dismissed");
    localStorage.setItem("install-prompt-dismissed", "1");
  });
  await droid.reload();
  await droidGuide.waitFor();
  await droid.waitForTimeout(600);
  await shot(droid, "28-guia-android-menu");
  check("Android sem o evento ensina pelo menu", await droidGuide.getByText("Instalar app").isVisible());

  await droid.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await droidGuide.waitFor({ state: "hidden" });
  check("instalar no Android marca a conta na hora", await accountMarked());
  await android.close();

  // O Chrome de teste não fala com o serviço de push: a inscrição é a única parte simulada.
  const notifying = await browser.newContext({ ...mobile, reducedMotion: "reduce" });
  await notifying.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "default" });
    Notification.requestPermission = async () => "granted";
    PushManager.prototype.getSubscription = async () => null;
    PushManager.prototype.subscribe = async () => ({
      toJSON: () => ({
        endpoint: "https://fcm.googleapis.com/fcm/send/e2e",
        keys: { p256dh: "chave-publica", auth: "segredo" },
      }),
    });
  });
  const pushPage = await notifying.newPage();
  await pushPage.goto(`${APP}/entrar`);
  await logIn(pushPage);
  await pushPage.evaluate(() => navigator.serviceWorker.ready);
  await pushPage.goto(`${APP}/matches`);
  await pushPage.getByRole("button", { name: "Ativar" }).click();
  await pushPage.getByRole("button", { name: "Ativar" }).waitFor({ state: "hidden" });
  check("autorizar notificações guarda o aparelho", (await sql(`select user_id from push_subscriptions where endpoint like '%/e2e'`))[0]?.user_id === userId);
  await sql(`delete from push_subscriptions where endpoint like '%/e2e'`);
  await notifying.close();

  // ---- versão nova
  const deployed = await (await fetch(`${APP}/api/version`)).json();
  check("servidor informa a versão do deploy", deployed.version === "e2e", deployed);

  // Sem o service worker, o Playwright enxerga o pedido e consegue simular um deploy novo.
  const updating = await browser.newContext({ ...mobile, reducedMotion: "reduce", serviceWorkers: "block" });
  const updatePage = await updating.newPage();
  await updatePage.goto(`${APP}/entrar`);
  await logIn(updatePage);
  await updatePage.waitForLoadState("networkidle");
  // O Next tira o atributo ao iniciar, para não atrapalhar a hidratação: só o HTML cru tem.
  check("página traz a versão do deploy", (await (await fetch(`${APP}/entrar`)).text()).includes('data-dpl-id="e2e"'));

  const updateButton = updatePage.getByRole("button", { name: "Atualizar" });
  const markPage = () => updatePage.evaluate(() => { window.samePage = true; });
  const pageKept = () => updatePage.evaluate(() => window.samePage === true);
  const returnToApp = () => updatePage.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

  await markPage();
  await returnToApp();
  await updatePage.waitForTimeout(500);
  check("sem deploy novo, nada acontece", (await pageKept()) && !(await updateButton.isVisible()));

  await updatePage.route("**/api/version", (route) => route.fulfill({ json: { version: "deploy-novo" } }));
  await returnToApp();
  await updatePage.waitForFunction(() => window.samePage !== true);
  check("ao voltar para o app, a versão nova entra sozinha", true);

  await updatePage.waitForLoadState("networkidle");
  await markPage();
  await returnToApp();
  await updateButton.waitFor();
  await shot(updatePage, "44-versao-nova");
  check("não recarrega em loop e passa a avisar", await pageKept());

  await updatePage.evaluate(() => sessionStorage.clear());
  await updatePage.goto(`${APP}/perfil/editar`);
  await updatePage.getByLabel("Bio").waitFor();
  // Digitar antes da hidratação perde o texto, e o teste culparia a atualização.
  await updatePage.waitForLoadState("networkidle");
  await updatePage.getByLabel("Bio").fill("Rascunho que não pode sumir");
  await markPage();
  await returnToApp();
  await updateButton.waitFor();
  const draft = { kept: await pageKept(), bio: await updatePage.getByLabel("Bio").inputValue() };
  check(
    "com formulário na tela, só avisa e mantém o que foi digitado",
    draft.kept && draft.bio === "Rascunho que não pode sumir",
    draft,
  );
  await updateButton.click();
  await updatePage.waitForFunction(() => window.samePage !== true);
  check("o botão aplica a versão nova", true);
  await updating.close();

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
