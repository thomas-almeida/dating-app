// Cria uma conta de admin, ou promove uma que já existe:
//   npm run admin:create -- voce@exemplo.com
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

const MIN_PASSWORD_LENGTH = 8;
const USERS_PER_PAGE = 1000;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Preencha o Supabase no .env.local antes de rodar.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function askPassword() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const password = await prompt.question(`Senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres): `);
  prompt.close();
  return password;
}

async function run() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Informe o e-mail: npm run admin:create -- voce@exemplo.com");

  const password = await askPassword();
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error("Senha muito curta.");

  const supabase = supabaseAdmin();
  const app_metadata = { role: "admin" };

  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata,
  });

  if (!error) {
    console.log(`Admin criado: ${email}`);
    return;
  }
  if (error.code !== "email_exists") throw error;

  const { data, error: listError } = await supabase.auth.admin.listUsers({
    perPage: USERS_PER_PAGE,
  });
  if (listError) throw listError;

  const user = data.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error("A conta existe, mas não apareceu na listagem.");

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password,
    app_metadata,
  });
  if (updateError) throw updateError;

  console.log(`Conta promovida a admin: ${email}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
