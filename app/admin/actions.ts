"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { emailLayout, sendEmail } from "@/lib/email";
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
    .select("id, email")
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("approveEntry", error);
    return FAILED;
  }

  const inviteUrl = `${await siteOrigin()}/convite/${invite.token}`;
  after(() =>
    sendEmail(data.email, {
      subject: "Seu acesso foi aprovado",
      text: `Sua entrada no Ágape foi aprovada. Crie sua senha pelo link: ${inviteUrl}`,
      html: emailLayout({
        preheader: "Seu acesso ao Ágape foi aprovado.",
        title: "Acesso aprovado",
        paragraphs: ["Sua entrada no Ágape foi aprovada.", "Crie sua senha para acessar o app."],
        button: { label: "Criar minha senha", url: inviteUrl },
      }),
    }),
  );

  revalidatePath("/admin");
  return { ok: true, inviteUrl };
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
