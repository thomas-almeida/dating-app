import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { connection } from "next/server";
import { INVITE_TTL_DAYS } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY_MS = 24 * 60 * 60 * 1000;

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Só o hash vai para o banco: um vazamento da tabela não entrega convites válidos.
export function createInvite() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: hashInviteToken(token),
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS).toISOString(),
  };
}

export async function findActiveInvite(token: string) {
  // A validade depende da hora atual: isso nunca pode entrar no prerender.
  await connection();

  const { data, error } = await createAdminClient()
    .from("waitlist")
    .select("name, email")
    .eq("invite_token_hash", hashInviteToken(token))
    .eq("status", "approved")
    .gt("invite_expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("findActiveInvite", error);
    return null;
  }
  return data;
}
