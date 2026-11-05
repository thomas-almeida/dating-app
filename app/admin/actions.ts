"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { createInvite } from "@/lib/invite";
import { siteOrigin } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminResult = { ok: true; inviteUrl?: string } | { ok: false; message: string };

const idSchema = z.uuid();

const FAILED: AdminResult = { ok: false, message: "Não deu para salvar. Tente de novo." };

// Serve para aprovar e para gerar um link novo: o hash anterior deixa de valer.
export async function approveEntry(id: string): Promise<AdminResult> {
  await requireAdmin();

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return FAILED;

  const invite = createInvite();
  const { data, error } = await createAdminClient()
    .from("waitlist")
    .update({
      status: "approved",
      invite_token_hash: invite.hash,
      invite_expires_at: invite.expiresAt,
      approved_at: new Date().toISOString(),
    })
    .eq("id", parsed.data)
    .neq("status", "activated")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("approveEntry", error);
    return FAILED;
  }

  revalidatePath("/admin");
  return { ok: true, inviteUrl: `${await siteOrigin()}/convite/${invite.token}` };
}

export async function rejectEntry(id: string): Promise<AdminResult> {
  await requireAdmin();

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return FAILED;

  const { error } = await createAdminClient()
    .from("waitlist")
    .update({ status: "rejected", invite_token_hash: null, invite_expires_at: null })
    .eq("id", parsed.data)
    .neq("status", "activated");

  if (error) {
    console.error("rejectEntry", error);
    return FAILED;
  }

  revalidatePath("/admin");
  return { ok: true };
}

// O admin nasce sem perfil. Com a linha criada, ele passa pelo mesmo onboarding de todo mundo.
export async function enterApp() {
  const { user } = await requireAdmin();

  const { error } = await createAdminClient()
    .from("profiles")
    .upsert(
      { id: user.id, name: user.email?.split("@")[0] ?? "Admin" },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (error) throw error;

  redirect("/inicio");
}

// Libera o Pro sem cobrança, para demonstrações.
export async function setPro(userId: string, isPro: boolean): Promise<AdminResult> {
  await requireAdmin();

  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) return FAILED;

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ is_pro: isPro })
    .eq("id", parsed.data);

  if (error) {
    console.error("setPro", error);
    return FAILED;
  }

  revalidatePath("/admin");
  return { ok: true };
}
