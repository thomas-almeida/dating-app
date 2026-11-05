"use client";

import { Film, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useActionState, useState, type ChangeEvent, type ReactNode } from "react";
import { Field, FormMessage, inputClass, textareaClass } from "@/components/field";
import { LoopVideo } from "@/components/loop-video";
import { SubmitButton } from "@/components/submit-button";
import { BRAZIL_STATES, MAX_PHOTOS, MAX_VIDEO_SECONDS, MEDIA_BUCKET } from "@/lib/config";
import { MediaError, uploadPhoto, uploadVideo, VIDEO_ACCEPT } from "@/lib/media-upload";
import { maskPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";
import type { FormState, Gender, Hobby } from "@/lib/types";
import { saveProfile } from "./actions";
import { HobbyPicker } from "./hobby-picker";

export type MediaItem = { path: string; url: string };

type ProfileValues = {
  name: string;
  nickname: string;
  bio: string;
  gender: Gender | null;
  birthDate: string;
  state: string;
  city: string;
  neighborhood: string;
  hobbies: Hobby[];
  whatsapp: string;
};

const initialState: FormState = { status: "idle" };

const MAX_BIO = 500;

const GENDERS: { value: Gender; label: string }[] = [
  { value: "female", label: "Mulher" },
  { value: "male", label: "Homem" },
];

const tileClass = "relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface";

// Só apaga na hora o que ainda não foi salvo. O resto sai quando o perfil for salvo.
function discard(item: MediaItem) {
  if (!item.url.startsWith("blob:")) return;
  URL.revokeObjectURL(item.url);
  void createClient().storage.from(MEDIA_BUCKET).remove([item.path]);
}

function FilledTile({
  label,
  onRemove,
  children,
}: {
  label: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className={tileClass}>
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover ${label}`}
        className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-black/60 text-cream"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function EmptyTile({
  label,
  icon,
  accept,
  busy,
  disabled,
  onPick,
}: {
  label: string;
  icon: ReactNode;
  accept: string;
  busy: boolean;
  disabled: boolean;
  onPick: (file: File) => void;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Sem limpar, escolher o mesmo arquivo de novo não dispara change.
    event.target.value = "";
    if (file) onPick(file);
  }

  return (
    <label
      className={`${tileClass} flex flex-col items-center justify-center gap-2 border border-dashed border-line text-muted transition focus-within:border-coral ${
        disabled ? "opacity-50" : "cursor-pointer hover:text-cream"
      }`}
    >
      {/* Sem name: o arquivo vai direto para o Storage, nunca pela Server Action. */}
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        className="sr-only"
      />
      {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : icon}
      <span className="text-xs font-medium">{busy ? "Enviando" : label}</span>
    </label>
  );
}

export function ProfileForm({
  userId,
  firstTime,
  initial,
  initialVideo,
  initialPhotos,
}: {
  userId: string;
  firstTime: boolean;
  initial: ProfileValues;
  initialVideo: MediaItem | null;
  initialPhotos: MediaItem[];
}) {
  const [state, formAction] = useActionState(saveProfile, initialState);
  // O React reseta o form quando a action termina, mesmo com erro: o estado guarda o que foi digitado.
  const [values, setValues] = useState(initial);
  const [video, setVideo] = useState(initialVideo);
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState<"video" | "photo" | null>(null);
  const [mediaError, setMediaError] = useState<string>();

  function update<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function pickVideo(file: File) {
    setMediaError(undefined);
    setUploading("video");
    try {
      const { path, blob } = await uploadVideo(userId, file);
      setVideo({ path, url: URL.createObjectURL(blob) });
    } catch (error) {
      setMediaError(
        error instanceof MediaError
          ? error.message
          : "Não deu para enviar esse vídeo. Tente outro em MP4.",
      );
    } finally {
      setUploading(null);
    }
  }

  async function pickPhoto(file: File) {
    setMediaError(undefined);
    setUploading("photo");
    try {
      const { path, blob } = await uploadPhoto(userId, file);
      setPhotos((current) => [...current, { path, url: URL.createObjectURL(blob) }]);
    } catch {
      setMediaError("Não deu para enviar essa foto. Tente uma em JPG ou PNG.");
    } finally {
      setUploading(null);
    }
  }

  function removeVideo() {
    if (video) discard(video);
    setVideo(null);
  }

  function removePhoto(item: MediaItem) {
    discard(item);
    setPhotos((current) => current.filter(({ path }) => path !== item.path));
  }

  const busy = uploading !== null;
  const emptyPhotoSlots = MAX_PHOTOS - photos.length;

  return (
    <form action={formAction} className="space-y-5 pb-10">
      <section aria-labelledby="media-title">
        <h2 id="media-title" className="mb-1.5 text-sm font-medium text-cream">
          Vídeo e fotos
        </h2>

        <div className="grid grid-cols-3 gap-3">
          {video ? (
            <FilledTile label="vídeo" onRemove={removeVideo}>
              <LoopVideo src={video.url} className="size-full object-cover" />
              <input type="hidden" name="video_path" value={video.path} />
            </FilledTile>
          ) : (
            <EmptyTile
              label="Vídeo"
              icon={<Film className="size-5" aria-hidden />}
              accept={VIDEO_ACCEPT}
              busy={uploading === "video"}
              disabled={busy}
              onPick={pickVideo}
            />
          )}

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

          {Array.from({ length: emptyPhotoSlots }, (_, index) => (
            <EmptyTile
              key={index}
              label="Foto"
              icon={<ImagePlus className="size-5" aria-hidden />}
              accept="image/*"
              busy={uploading === "photo" && index === 0}
              disabled={busy}
              onPick={pickPhoto}
            />
          ))}
        </div>

        <p className="mt-1.5 text-xs text-muted">
          Coloque pelo menos um. O vídeo toca em loop, sem som, e pode ter até {MAX_VIDEO_SECONDS}{" "}
          segundos.
        </p>

        {mediaError && (
          <div className="mt-3">
            <FormMessage message={mediaError} />
          </div>
        )}
      </section>

      <Field label="Nome">
        <input
          name="name"
          required
          maxLength={80}
          autoComplete="name"
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Apelido" hint="É o que aparece no seu card.">
        <input
          name="nickname"
          required
          maxLength={40}
          autoComplete="nickname"
          value={values.nickname}
          onChange={(event) => update("nickname", event.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Bio" hint={`${values.bio.length} de ${MAX_BIO} caracteres`}>
        <textarea
          name="bio"
          required
          maxLength={MAX_BIO}
          placeholder="Fale da sua fé, da sua igreja e do que você gosta de fazer."
          value={values.bio}
          onChange={(event) => update("bio", event.target.value)}
          className={textareaClass}
        />
      </Field>

      <HobbyPicker value={values.hobbies} onChange={(hobbies) => update("hobbies", hobbies)} />

      {/* defaultChecked e não checked: o reset desmarcaria um rádio controlado sem avisar o estado. */}
      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-cream">Você é</legend>
        <div className="grid grid-cols-2 gap-3">
          {GENDERS.map(({ value, label }) => (
            <label key={value} className="block cursor-pointer">
              <input
                type="radio"
                name="gender"
                value={value}
                required
                defaultChecked={values.gender === value}
                onChange={() => update("gender", value)}
                className="peer sr-only"
              />
              <span className="flex h-13 items-center justify-center rounded-2xl border border-line bg-surface font-semibold text-muted transition peer-checked:border-cream peer-checked:bg-cream peer-checked:text-ink peer-focus-visible:border-coral">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Data de nascimento" hint="Só a sua idade aparece no perfil.">
        <input
          type="date"
          name="birth_date"
          required
          autoComplete="bday"
          value={values.birthDate}
          onChange={(event) => update("birthDate", event.target.value)}
          className={`${inputClass} scheme-dark`}
        />
      </Field>

      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <Field label="Estado">
          <select
            name="state"
            required
            autoComplete="address-level1"
            value={values.state}
            onChange={(event) => update("state", event.target.value)}
            className={`${inputClass} scheme-dark`}
          >
            <option value="" disabled>
              UF
            </option>
            {BRAZIL_STATES.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </Field>
        <Field label="Cidade">
          <input
            name="city"
            required
            maxLength={80}
            autoComplete="address-level2"
            value={values.city}
            onChange={(event) => update("city", event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Bairro" hint="Aparece no seu card para as outras pessoas.">
        <input
          name="neighborhood"
          required
          maxLength={80}
          autoComplete="address-level3"
          value={values.neighborhood}
          onChange={(event) => update("neighborhood", event.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="WhatsApp" hint="Só quem assina o Pro consegue ver esse número.">
        <input
          name="whatsapp"
          required
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(11) 91234-5678"
          value={values.whatsapp}
          onChange={(event) => update("whatsapp", maskPhone(event.target.value))}
          className={inputClass}
        />
      </Field>

      <FormMessage message={state.status === "error" ? state.message : undefined} />

      <SubmitButton disabled={busy}>{firstTime ? "Concluir perfil" : "Salvar"}</SubmitButton>
    </form>
  );
}
