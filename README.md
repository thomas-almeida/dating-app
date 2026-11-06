# Ágape

MVP de um app de relacionamento para jovens cristãos: lista de espera, aprovação manual, perfil com vídeo e fotos, home com cards e stories, e assinatura Pro. Roda como PWA.

Stack: Next.js 16, TypeScript, Tailwind 4, Supabase e AbacatePay.

> "Ágape" e os textos da LP são provisórios. O nome fica em `lib/config.ts`, junto com o preço exibido, que precisa ser igual ao do produto no AbacatePay.

## Como funciona

1. A pessoa entra na lista de espera pela LP (`/`).
2. O admin aprova em `/admin` e recebe um link de convite, que manda pelo WhatsApp.
3. Pelo link (`/convite/[token]`), a pessoa cria a senha.
4. Ela preenche o perfil (`/perfil/editar`). A home só abre com o perfil completo.
5. Na home (`/inicio`), curte ou passa nos cards. Curtida dos dois lados vira match (`/matches`). Quem já passou volta depois de quem ainda não foi visto.
6. Qualquer pessoa posta story: 1 a cada 24 horas no plano free, sem limite no Pro. O dono vê quem viu e quem curtiu.
7. Quem deu match conversa pelo chat do app (`/conversas/[id]`), sem precisar do Pro.
8. Ver e curtir stories de outras pessoas, o botão de WhatsApp, as métricas do perfil e a lista de quem curtiu (`/curtidas`) são do Pro (`/pro`).
9. Em `/eventos`, qualquer pessoa cria eventos e confirma presença nos eventos dos outros.

## Rodando localmente

Precisa de Node 24 e de um projeto no Supabase.

```bash
npm install
cp .env.example .env.local
```

1. Preencha o `.env.local`.
2. Aplique as migrations de `supabase/migrations`, em ordem, pelo SQL Editor do Supabase ou com `supabase db push`.
3. Em Authentication > Sign In / Providers, desligue **Allow new users to sign up**. As contas só nascem pelo convite.
4. Crie o admin e, se quiser, os perfis de exemplo:

```bash
npm run admin:create -- voce@exemplo.com
npm run seed:demo
npm run dev
```

O app abre em <http://localhost:3000> e o admin entra por `/entrar`.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o app em modo de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm run lint` | Roda o ESLint |
| `npm test` | Roda os testes unitários e os do banco |
| `npm run test:unit` | Testa as regras puras: telefone, convite e webhook |
| `npm run test:db` | Aplica as migrations num Postgres em memória e testa RLS e RPCs |
| `npm run test:e2e` | Roda o fluxo completo no Chrome contra um backend simulado |
| `npm run admin:create -- <email>` | Cria um admin ou promove uma conta existente |
| `npm run seed:demo` | Cria 8 perfis de exemplo. Rodar de novo faz metade deles curtir as contas reais, para mostrar o match |
| `npm run seed:demo -- --remove` | Apaga os perfis de exemplo |
| `npm run seed:bots` | Cria os perfis de apresentação com as mídias de `public/bot`. Rodar de novo renova os stories deles e faz os bots curtirem as contas reais |
| `npm run seed:bots -- --remove` | Apaga os perfis de apresentação |
| `npm run icons` | Gera os ícones do PWA em `public/icons` |

## Testes

Rode `npm test` a cada mudança e `npm run test:e2e` antes de publicar. Toda correção de bug deve entrar com um teste que falharia sem ela.

- **Banco** (`scripts/test-migration.ts`): limite de stories, quem vê o quê, métricas do Pro, preferências, chat, eventos e acesso direto às tabelas.
- **Ponta a ponta** (`tests/e2e/regression.mjs`): do cadastro na LP ao cancelamento do Pro, passando por stories, métricas, chat, eventos e PWA.

A regressão precisa do Google Chrome instalado. Ela usa as migrations reais num Postgres em memória, com Supabase e AbacatePay simulados em `tests/e2e/fake-backend.mjs`, e gera o build em `.next-e2e`. Nada toca os serviços de verdade. As capturas de tela ficam em `tests/e2e/.output/shots`.

## AbacatePay

1. Crie na loja um produto de assinatura mensal e coloque o id em `ABACATEPAY_PRO_PRODUCT_ID`.
2. Gere uma chave com permissão `SUBSCRIPTION:DELETE`, necessária para o cancelamento.
3. Cadastre o webhook apontando para a URL abaixo, com os eventos de assinatura e de checkout:

```text
https://SEU_DOMINIO/api/webhooks/abacatepay?webhookSecret=SEU_SEGREDO
```

Use o mesmo segredo em `ABACATEPAY_WEBHOOK_SECRET`.

No Dev mode, o cartão `4242 4242 4242 4242` é aprovado. Teste com ele antes de ir para produção, porque a documentação não descreve o formato completo do evento de assinatura. Eventos que não casam com nenhuma assinatura ficam em `payment_events` com `processed_at` nulo, para conferência.

O cancelamento no AbacatePay é imediato e irreversível, e a tela do Pro avisa isso antes de confirmar. Para demonstrações, o admin libera o Pro sem cobrança na aba Ativos.

## PWA

O manifest está em `app/manifest.ts` e o service worker em `public/sw.js`. Ele guarda só arquivos estáticos e a tela `/offline`, e nunca o HTML das páginas, que tem dados de quem está logado. Ao mudar a estratégia de cache, troque a constante `CACHE`.

A instalação exige HTTPS fora do `localhost`. Para testar no celular em desenvolvimento, use `next dev --experimental-https`.

Um PWA reaberto da memória do celular continua com o JavaScript antigo, e as Server Actions dele somem no deploy seguinte. Para isso não acontecer, cada deploy tem uma versão (`deploymentId`, em `next.config.ts`):

- Ao navegar, o próprio Next percebe a diferença e recarrega a página inteira.
- Ao voltar para o app, `components/update-prompt.tsx` compara a versão com `/api/version`. Sem formulário na tela, recarrega sozinho, uma vez por versão. Com formulário, mostra o aviso, para não apagar o que a pessoa digitou.
- Com o app aberto, a checagem roda a cada `UPDATE_CHECK_MS` e só mostra o aviso.

A versão vem de `VERCEL_DEPLOYMENT_ID`, com `VERCEL_GIT_COMMIT_SHA` como alternativa. Mantenha ligada a opção "Automatically expose System Environment Variables" na Vercel. Em `next dev`, sem essas variáveis, nada disso roda.

Ao chegar em `/inicio` pelo navegador do celular, a pessoa vê o guia de instalação (`components/install-prompt.tsx`), com o passo a passo do aparelho dela. Quem está no Chrome do Android instala em um toque. A detecção e o evento de instalação ficam em `lib/install.ts`. Depois de "Agora não", o guia volta a cada `INSTALL_REMINDER_DAYS` e em todo login. Ele não aparece no computador. Para ver no computador, use a emulação de celular do DevTools.

Ao abrir o app instalado, ou ao instalar pelo Chrome, a conta recebe `profiles.app_installed_at` e o guia não aparece mais em nenhum navegador. A marca fica no banco porque, no iPhone, o Safari não enxerga o storage do app instalado.

## Afinidade

Bairro, cidade, estado e até 3 gostos (`{ "emoji": "🏖", "hobbie": "Praia" }`) ficam no perfil e aparecem para as outras pessoas. As regras estão em `lib/affinity.ts`: gosto em comum é ter um emoji igual, e mesma região é ter a mesma cidade e o mesmo estado. O card, o perfil e a tela de match mostram todos os gostos da pessoa, com os em comum em destaque, e avisam quando ela é da mesma região.

Perfis criados antes da migration `0004` ficam sem esses dados até serem editados. `npm run seed:bots` atualiza os bots que já existem. Em `seed:demo`, rode com `--remove` e depois de novo.

Altura, igreja e cor da pele são opcionais. A igreja aparece no card, e quem é da mesma igreja vem primeiro no deck. A cor da pele nunca sai das RPCs: ela só decide em quais filtros a pessoa entra. As opções ficam em `lib/config.ts`.

Em `/perfil/editar`, a pessoa escolhe quem quer ver por sexo, igreja e cor da pele. Lista vazia significa sem filtro, e em sexo mantém o padrão: o sexo oposto. A regra de sexo vale nos dois sentidos (`can_pair`): duas pessoas só se veem se cada uma quiser ver o sexo da outra. Quem não informou igreja ou cor fica de fora de quem filtrou por elas.

## Chat e notificações

O chat é só entre quem deu match, e desfazer o match fecha a conversa. As tabelas não têm grant para os clientes: tudo passa pelas funções da migration `0007`, que conferem o match a cada chamada.

Com a conversa aberta, o navegador consulta o Supabase a cada `CHAT_POLL_MS`, direto e sem passar pelo servidor do app. Uma mensagem conta como visualizada quando a conversa está aberta e visível.

As notificações usam Web Push e dependem da autorização da pessoa, pedida em `/matches`. No iPhone, só funcionam com o app instalado na tela inicial. O texto da mensagem não vai na notificação, porque ela aparece na tela bloqueada.

Para ligar, gere as chaves e coloque nas variáveis `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`, inclusive na Vercel:

```bash
npx web-push generate-vapid-keys
```

Sem elas, o app funciona normalmente e não oferece as notificações. Trocar as chaves invalida os aparelhos já inscritos.

## Eventos

Só quem criou edita e exclui, e essa pessoa já entra como confirmada. As fotos ficam na pasta dela no Storage e saem junto quando são removidas. A data é sempre lida e mostrada em horário de Brasília (`lib/event-date.ts`). A lista mostra os próximos eventos e os do último dia, e um evento que já começou não aceita novas confirmações.

## Antes de lançar

- Remover os perfis de exemplo com `npm run seed:demo -- --remove` e `npm run seed:bots -- --remove`. Para quem usa o app, eles parecem pessoas reais.
- Apagar `public/bot`: tudo que fica em `public` é servido publicamente.
- Publicar política de privacidade e termos. Crença religiosa e cor da pele são dados sensíveis na LGPD, e o tratamento pede consentimento específico.
- Criar denúncia e bloqueio de perfis, de mensagens e de eventos.
- Criar recuperação de senha por e-mail.
- Colocar limite de tentativas na LP e no login, que hoje têm só um honeypot na LP.
