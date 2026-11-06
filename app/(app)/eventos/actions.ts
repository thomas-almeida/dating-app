"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MAX_EVENT_PHOTOS, MEDIA_BUCKET } from "@/lib/config";
import { requireMember } from "@/lib/dal";
import { fromDateInput } from "@/lib/event-date";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

const schema = z.object({
  eventId: z.uuid().nullable(),
  name: z.string().trim().min(1, "Dê um nome ao evento.").max(80, "Nome muito longo."),
  description: z
    .string()
    .trim()
    .min(1, "Conte como vai ser o evento.")
    .max(1000, "Descrição muito longa."),
  location: z.string().trim().min(1, "Informe o local.").max(160, "Local muito longo."),
  organizer: z.string().trim().min(1, "Diga quem organiza.").max(80, "Nome muito longo."),
  startsAt: z
    .string({ error: "Informe a data e a hora." })
    .transform(fromDateInput)
    .refine((value) => value !== null, "Informe a data e a hora."),
  photoPaths: z
    .array(z.string().min(1))
    .max(MAX_EVENT_PHOTOS, `Escolha até ${MAX_EVENT_PHOTOS} fotos.`),
});

const FAILED: FormState = { status: "error", message: "Não deu para salvar. Tente de novo." };

async function removeFiles(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
  if (error) console.error("removeFiles", error);
}

export async function saveEvent(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireMember();

  const parsed = schema.safeParse({
    eventId: formData.get("event_id"),
    name: formData.get("name"),
    description: formData.get("description"),
    location: formData.get("location"),
    organizer: formData.get("organizer"),
    startsAt: formData.get("starts_at"),
    photoPaths: formData.getAll("photo_paths"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? FAILED.message };
  }

  const { eventId, name, description, location, organizer, startsAt, photoPaths } = parsed.data;
  const fields = {
    name,
    description,
    location,
    organizer,
    starts_at: startsAt,
    photo_paths: photoPaths,
  };
  const supabase = await createClient();

  if (!eventId) {
    if (new Date(startsAt as string) <= new Date()) {
      return { status: "error", message: "Escolha uma data no futuro." };
    }

    const { data, error } = await supabase
      .from("events")
      .insert({ ...fields, owner_id: user.id })
      .select("id")
      .single();

    if (error) {
      console.error("saveEvent insert", error);
      return FAILED;
    }

    revalidatePath("/eventos");
    redirect(`/eventos/${data.id}`);
  }

  const { data: current } = await supabase
    .from("events")
    .select("photo_paths")
    .eq("id", eventId)
    .eq("owner_id", user.id)
    .maybeSingle();

  // A RLS já impede a edição: aqui é só para não dizer que salvou.
  if (!current) return FAILED;

  const { error } = await supabase.from("events").update(fields).eq("id", eventId);

  if (error) {
    console.error("saveEvent update", error);
    return FAILED;
  }

  await removeFiles(
    (current.photo_paths as string[]).filter((path) => !photoPaths.includes(path)),
  );

  revalidatePath("/eventos", "layout");
  redirect(`/eventos/${eventId}`);
}

export async function deleteEvent(eventId: string) {
  if (!z.uuid().safeParse(eventId).success) return;

  const { user } = await requireMember();
  const supabase = await createClient();

  const { data: removed, error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("owner_id", user.id)
    .select("photo_paths")
    .maybeSingle();

  if (error) {
    console.error("deleteEvent", error);
    return;
  }

  if (removed) await removeFiles(removed.photo_paths as string[]);

  revalidatePath("/eventos", "layout");
  redirect("/eventos");
}

export async function toggleAttendance(eventId: string) {
  if (!z.uuid().safeParse(eventId).success) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_event_attendance", { p_event: eventId });
  if (error) console.error("toggleAttendance", error);

  revalidatePath("/eventos", "layout");
}
