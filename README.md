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
7. Ver e curtir stories de outras pessoas, o botão de WhatsApp, as métricas do perfil e a lista de quem curtiu (`/curtidas`) são do Pro (`/pro`).

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

- **Banco** (`scripts/test-migration.ts`): limite de stories, quem vê o quê, métricas do Pro e acesso direto às tabelas.
- **Ponta a ponta** (`tests/e2e/regression.mjs`): do cadastro na LP ao cancelamento do Pro, passando por stories, métricas e PWA.

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

## Antes de lançar

- Remover os perfis de exemplo com `npm run seed:demo -- --remove` e `npm run seed:bots -- --remove`. Para quem usa o app, eles parecem pessoas reais.
- Apagar `public/bot`: tudo que fica em `public` é servido publicamente.
- Publicar política de privacidade e termos. Crença religiosa é dado sensível na LGPD.
- Criar denúncia e bloqueio de perfis.
- Criar recuperação de senha por e-mail.
- Colocar limite de tentativas na LP e no login, que hoje têm só um honeypot na LP.
