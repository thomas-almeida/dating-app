"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_AD_DESCRIPTION, MAX_AD_TITLE, MEDIA_BUCKET } from "@/lib/config";
import { requireAdmin } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminResult } from "@/app/admin/actions";

const FAILED: AdminResult = { ok: false, message: "Não deu para salvar. Tente de novo." };

// Só https: um link javascript: ou data: aqui viraria execução de script no app.
const adSchema = z.object({
  title: z.string().trim().min(1).max(MAX_AD_TITLE),
  description: z.string().trim().min(1).max(MAX_AD_DESCRIPTION),
  targetUrl: z.string().trim().url().max(600).startsWith("https://"),
});

const idSchema = z.uuid();

// As imagens dos anúncios ficam fora das pastas dos usuários: ninguém as alcança pela RLS,
// e o signPaths (service role) assina para quem o active_ads liberar.
const AD_FOLDER = "ads";

export async function createAd(formData: FormData): Promise<AdminResult> {
  await requireAdmin();

  const parsed = adSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    targetUrl: formData.get("targetUrl"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Confira o título, a descrição e o link (precisa ser https)." };
  }

  const image = formData.get("image");
  if (!(image instanceof Blob) || image.size === 0) {
    return { ok: false, message: "Escolha a imagem do anúncio." };
  }

  const admin = createAdminClient();
  const path = `${AD_FOLDER}/${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(path, image, { contentType: "image/jpeg" });

  if (uploadError) {
    console.error("createAd upload", uploadError);
    return FAILED;
  }

  const { error } = await admin.from("ads").insert({
    title: parsed.data.title,
    description: parsed.data.description,
    target_url: parsed.data.targetUrl,
    image_path: path,
  });

  if (error) {
    // Sem a linha, o arquivo ficaria no Storage sem uso.
    await admin.storage.from(MEDIA_BUCKET).remove([path]);
    console.error("createAd", error);
    return FAILED;
  }

  revalidatePath("/admin/anuncios");
  // O deck de quem está com a home aberta só muda na próxima carga, e isso é aceitável.
  return { ok: true };
}

export async function setAdActive(id: string, active: boolean): Promise<AdminResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return FAILED;

  const { error } = await createAdminClient().from("ads").update({ active }).eq("id", id);

  if (error) {
    console.error("setAdActive", error);
    return FAILED;
  }

  revalidatePath("/admin/anuncios");
  return { ok: true };
}

// Apaga a linha e a imagem. Os eventos vão junto pelo on delete cascade: quem quiser
// guardar o histórico de um anúncio encerrado deve desativar em vez de excluir.
export async function deleteAd(id: string): Promise<AdminResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return FAILED;

  const admin = createAdminClient();

  const { data: ad, error: readError } = await admin
    .from("ads")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    console.error("deleteAd", readError);
    return FAILED;
  }
  if (!ad) return FAILED;

  const { error } = await admin.from("ads").delete().eq("id", id);
  if (error) {
    console.error("deleteAd", error);
    return FAILED;
  }

  const { error: removeError } = await admin.storage.from(MEDIA_BUCKET).remove([ad.image_path]);
  // A linha já saiu: um arquivo órfão no Storage não justifica mostrar erro a quem apagou.
  if (removeError) console.error("deleteAd remove", removeError);

  revalidatePath("/admin/anuncios");
  return { ok: true };
}
