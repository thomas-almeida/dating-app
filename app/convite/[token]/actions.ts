"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashInviteToken } from "@/lib/invite";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

const schema = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8, "Use pelo menos 8 caracteres na senha.")
      .max(72, "Use no máximo 72 caracteres na senha."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, { error: "As senhas não são iguais." });

const GENERIC_ERROR: FormState = {
  status: "error",
  message: "Não deu para criar a sua conta agora. Tente de novo em instantes.",
};

export async function acceptInvite(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  if (!isSupabaseConfigured()) return GENERIC_ERROR;

  const { token, password } = parsed.data;
  const admin = createAdminClient();

  // Reclama o convite antes de criar a conta: dois envios simultâneos não geram duas contas.
  const { data: invite, error: claimError } = await admin
    .from("waitlist")
    .update({ status: "activated" })
    .eq("invite_token_hash", hashInviteToken(token))
    .eq("status", "approved")
    .gt("invite_expires_at", new Date().toISOString())
    .select("id, name, email, phone")
    .maybeSingle();

  if (claimError) {
    console.error("acceptInvite claim", claimError);
    return GENERIC_ERROR;
  }
  if (!invite) {
    return { status: "error", message: "Esse convite não vale mais. Peça um novo link." };
  }

  const releaseInvite = () =>
    admin.from("waitlist").update({ status: "approved" }).eq("id", invite.id);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });

  if (createError) {
    await releaseInvite();
    if (createError.code === "email_exists") {
      return { status: "error", message: "Já existe uma conta com esse e-mail. Entre pelo login." };
    }
    if (createError.code === "weak_password") {
      return { status: "error", message: "Essa senha é fácil de adivinhar. Escolha outra." };
    }
    console.error("acceptInvite createUser", createError);
    return GENERIC_ERROR;
  }

  const userId = created.user.id;
  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: userId, name: invite.name });
  const { error: contactError } = profileError
    ? { error: profileError }
    : await admin.from("profile_contacts").insert({ user_id: userId, whatsapp: invite.phone });

  if (contactError) {
    console.error("acceptInvite profile", contactError);
    await admin.auth.admin.deleteUser(userId);
    await releaseInvite();
    return GENERIC_ERROR;
  }

  await admin
    .from("waitlist")
    .update({ user_id: userId, invite_token_hash: null, invite_expires_at: null })
    .eq("id", invite.id);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });

  redirect(signInError ? "/entrar" : "/perfil/editar");
}
