"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { emojiKey, isSingleEmoji } from "@/lib/affinity";
import { BRAZIL_STATES, MAX_HOBBIES, MAX_PHOTOS, MEDIA_BUCKET } from "@/lib/config";
import { requireUser } from "@/lib/dal";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

const hobbySchema = z.object({
  emoji: z.string().trim().refine(isSingleEmoji, "Use um emoji só em cada gosto."),
  hobbie: z.string().trim().min(1, "Dê um nome para cada gosto.").max(30, "Nome de gosto muito longo."),
});

const schema = z.object({
  name: z.string().trim().min(1, "Conte como você se chama.").max(80, "Nome muito longo."),
  nickname: z.string().trim().min(1, "Escolha um apelido.").max(40, "Apelido muito longo."),
  bio: z.string().trim().min(1, "Escreva uma bio.").max(500, "Bio muito longa."),
  gender: z.enum(["male", "female"], { error: "Selecione uma opção em “Você é”." }),
  birthDate: z.iso.date({ error: "Informe sua data de nascimento." }),
  state: z.enum(BRAZIL_STATES, { error: "Selecione o seu estado." }),
  city: z.string().trim().min(1, "Informe a sua cidade.").max(80, "Nome de cidade muito longo."),
  neighborhood: z.string().trim().min(1, "Informe o seu bairro.").max(80, "Nome de bairro muito longo."),
  hobbies: z
    .array(hobbySchema, { error: "Não deu para ler os seus gostos. Escolha de novo." })
    .max(MAX_HOBBIES, `Escolha até ${MAX_HOBBIES} gostos.`)
    .refine(
      (hobbies) => new Set(hobbies.map(({ emoji }) => emojiKey(emoji))).size === hobbies.length,
      "Use um emoji diferente em cada gosto.",
    ),
  whatsapp: z.string(),
  videoPath: z.string().min(1).nullable(),
  photoPaths: z.array(z.string().min(1)).max(MAX_PHOTOS, `Escolha até ${MAX_PHOTOS} fotos.`),
});

function parseHobbies(raw: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

// O gatilho profiles_guard devolve estes códigos em error.message.
const GUARD_ERRORS: Record<string, string> = {
  underage: "O app é só para maiores de 18 anos.",
  too_many_photos: `Escolha até ${MAX_PHOTOS} fotos.`,
  foreign_media: "Não reconhecemos um dos arquivos. Envie de novo.",
};

const FAILED: FormState = { status: "error", message: "Não deu para salvar. Tente de novo." };

export async function saveProfile(_: FormState, formData: FormData): Promise<FormState> {
  const { user, profile } = await requireUser();

  const parsed = schema.safeParse({
    name: formData.get("name"),
    nickname: formData.get("nickname"),
    bio: formData.get("bio"),
    gender: formData.get("gender"),
    birthDate: formData.get("birth_date"),
    state: formData.get("state"),
    city: formData.get("city"),
    neighborhood: formData.get("neighborhood"),
    hobbies: parseHobbies(formData.get("hobbies")),
    whatsapp: formData.get("whatsapp"),
    videoPath: formData.get("video_path"),
    photoPaths: formData.getAll("photo_paths"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? FAILED.message };
  }

  const { name, nickname, bio, gender, birthDate, state, city, neighborhood, hobbies } = parsed.data;
  const { videoPath, photoPaths } = parsed.data;

  const whatsapp = normalizePhone(parsed.data.whatsapp);
  if (!whatsapp) return { status: "error", message: "Confira o WhatsApp: use DDD e número." };

  if (!videoPath && photoPaths.length === 0) {
    return { status: "error", message: "Coloque um vídeo ou pelo menos uma foto." };
  }

  const supabase = await createClient();

  // O contato vem primeiro: o perfil completo já fica visível para os outros.
  // Upsert com service role porque a conta de admin nasce sem contato e ninguém tem grant de insert.
  const { error: contactError } = await createAdminClient()
    .from("profile_contacts")
    .upsert({ user_id: user.id, whatsapp });

  if (contactError) {
    console.error("saveProfile contact", contactError);
    return FAILED;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      name,
      nickname,
      bio,
      gender,
      birth_date: birthDate,
      state,
      city,
      neighborhood,
      hobbies,
      video_path: videoPath,
      photo_paths: photoPaths,
    })
    .eq("id", user.id);

  if (error) {
    const message = GUARD_ERRORS[error.message];
    if (message) return { status: "error", message };
    console.error("saveProfile", error);
    return FAILED;
  }

  const kept = new Set([videoPath, ...photoPaths]);
  const removed = [profile.video_path, ...profile.photo_paths].flatMap((path) =>
    path && !kept.has(path) ? [path] : [],
  );

  if (removed.length > 0) {
    const { error: removeError } = await supabase.storage.from(MEDIA_BUCKET).remove(removed);
    if (removeError) console.error("saveProfile remove", removeError);
  }

  revalidatePath("/", "layout");
  redirect(profile.onboarded_at ? "/perfil" : "/inicio");
}
