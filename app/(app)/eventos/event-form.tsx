"use client";

import { ImagePlus } from "lucide-react";
import { useActionState, useState } from "react";
import { Field, FormMessage, inputClass, textareaClass } from "@/components/field";
import { discardMedia, EmptyTile, FilledTile, type MediaItem } from "@/components/media-tiles";
import { SubmitButton } from "@/components/submit-button";
import { MAX_EVENT_PHOTOS } from "@/lib/config";
import { uploadPhoto } from "@/lib/media-upload";
import type { FormState } from "@/lib/types";
import { saveEvent } from "./actions";

export type EventValues = {
  name: string;
  description: string;
  location: string;
  organizer: string;
  startsAt: string;
};

const initialState: FormState = { status: "idle" };

const MAX_DESCRIPTION = 1000;

export function EventForm({
  userId,
  eventId,
  initial,
  initialPhotos,
}: {
  userId: string;
  eventId?: string;
  initial: EventValues;
  initialPhotos: MediaItem[];
}) {
  const [state, formAction] = useActionState(saveEvent, initialState);
  // O React reseta o form quando a action termina, mesmo com erro: o estado guarda o que foi digitado.
  const [values, setValues] = useState(initial);
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string>();

  function update<K extends keyof EventValues>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function pickPhoto(file: File) {
    setMediaError(undefined);
    setUploading(true);
    try {
      const { path, blob } = await uploadPhoto(userId, file);
      setPhotos((current) => [...current, { path, url: URL.createObjectURL(blob) }]);
    } catch {
      setMediaError("Não deu para enviar essa foto. Tente uma em JPG ou PNG.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(item: MediaItem) {
    discardMedia(item);
    setPhotos((current) => current.filter(({ path }) => path !== item.path));
  }

  const emptySlots = MAX_EVENT_PHOTOS - photos.length;

  return (
    <form action={formAction} className="space-y-5 pb-10">
      {eventId && <input type="hidden" name="event_id" value={eventId} />}

      <section aria-labelledby="event-photos-title">
        <h2 id="event-photos-title" className="mb-1.5 text-sm font-medium text-cream">
          Fotos
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {photos.map((photo, index) => (
            <FilledTile
              key={photo.path}
              label={`foto ${index + 1}`}
              onRemove={() => removePhoto(photo)}
            >
              <img src={photo.url} alt="" className="size-full object-cover" />
              <input type="hidden" name="photo_paths" value={photo.path} />
            </FilledTile>
          ))}
          {Array.from({ length: emptySlots }, (_, index) => (
            <EmptyTile
              key={index}
              label="Foto"
              icon={<ImagePlus className="size-5" aria-hidden />}
              accept="image/*"
              busy={uploading && index === 0}
              disabled={uploading}
              onPick={pickPhoto}
            />
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">Até {MAX_EVENT_PHOTOS} fotos. A primeira vira a capa.</p>
        {mediaError && (
          <div className="mt-3">
            <FormMessage message={mediaError} />
          </div>
        )}
      </section>

      <Field label="Nome do evento">
        <input
          name="name"
          required
          maxLength={80}
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Descrição" hint={`${values.description.length} de ${MAX_DESCRIPTION} caracteres`}>
        <textarea
          name="description"
          required
          maxLength={MAX_DESCRIPTION}
          placeholder="Conte como vai ser e o que levar."
          value={values.description}
          onChange={(event) => update("description", event.target.value)}
          className={textareaClass}
        />
      </Field>

      <Field label="Local">
        <input
          name="location"
          required
          maxLength={160}
          placeholder="Igreja, endereço ou ponto de encontro"
          value={values.location}
          onChange={(event) => update("location", event.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Data e hora" hint="Horário de Brasília.">
        <input
          type="datetime-local"
          name="starts_at"
          required
          value={values.startsAt}
          onChange={(event) => update("startsAt", event.target.value)}
          className={`${inputClass} scheme-dark`}
        />
      </Field>

      <Field label="Organizado por">
        <input
          name="organizer"
          required
          maxLength={80}
          value={values.organizer}
          onChange={(event) => update("organizer", event.target.value)}
          className={inputClass}
        />
      </Field>

      <FormMessage message={state.status === "error" ? state.message : undefined} />

      <SubmitButton disabled={uploading}>{eventId ? "Salvar evento" : "Criar evento"}</SubmitButton>
    </form>
  );
}
