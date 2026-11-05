import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Encerra a assinatura e só tira o Pro se não sobrar outra ativa.
export async function closeSubscription(row: { id: string; user_id: string }) {
  const admin = createAdminClient();

  const { error } = await admin
    .from("subscriptions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (error) throw error;

  const { count, error: countError } = await admin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", row.user_id)
    .eq("status", "active");
  if (countError) throw countError;
  if (count) return;

  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_pro: false })
    .eq("id", row.user_id);
  if (profileError) throw profileError;
}
