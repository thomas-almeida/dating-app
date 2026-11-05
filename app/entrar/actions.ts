"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Esse e-mail não parece válido.")),
  password: z.string().min(1, "Digite a sua senha."),
});

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  if (!isSupabaseConfigured()) {
    return { status: "error", message: "O login ainda não está disponível. Tente mais tarde." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "invalid_credentials") {
      return { status: "error", message: "E-mail ou senha incorretos." };
    }
    console.error("signIn", error);
    return { status: "error", message: "Não deu para entrar agora. Tente de novo em instantes." };
  }

  redirect(data.user.app_metadata?.role === "admin" ? "/admin" : "/inicio");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/entrar");
}
