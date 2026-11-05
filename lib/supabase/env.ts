// O acesso precisa ser literal para o Next embutir as variáveis no bundle do cliente.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function isSupabaseConfigured() {
  return supabaseEnv() !== null && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
