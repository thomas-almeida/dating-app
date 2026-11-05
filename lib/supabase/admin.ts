import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

// Ignora o RLS. Só para o que o usuário não pode fazer sozinho: lista de espera,
// criação de conta, URLs assinadas e assinaturas.
export function createAdminClient() {
  const env = supabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !serviceKey) throw new Error("Supabase não configurado");

  return createClient(env.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
