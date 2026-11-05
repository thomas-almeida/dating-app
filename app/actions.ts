"use server";

import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { FormState } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Conte pra gente o seu nome.").max(80, "Nome muito longo."),
  email: z.string().trim().toLowerCase().pipe(z.email("Esse e-mail não parece válido.")),
  phone: z.string(),
  consent: z.literal("on", { error: "Confirme que tem 18 anos ou mais para continuar." }),
});

const SUCCESS: FormState = {
  status: "ok",
  message: "Você está na lista. Quando for aprovado, enviamos o seu convite.",
};

export async function joinWaitlist(_: FormState, formData: FormData): Promise<FormState> {
  // Campo invisível: quem preenche é robô. Responde como sucesso para não dar pista.
  if (formData.get("website")) return SUCCESS;

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    consent: formData.get("consent"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { status: "error", message: "Informe o telefone com DDD." };

  if (!isSupabaseConfigured()) {
    return { status: "error", message: "O cadastro ainda não está disponível. Tente mais tarde." };
  }

  const { error } = await createAdminClient()
    .from("waitlist")
    .insert({ name: parsed.data.name, email: parsed.data.email, phone });

  // E-mail repetido recebe a mesma resposta: o formulário não revela quem já se cadastrou.
  if (error && error.code !== "23505") {
    console.error("waitlist insert", error);
    return { status: "error", message: "Não deu para salvar agora. Tente de novo em instantes." };
  }

  return SUCCESS;
}
