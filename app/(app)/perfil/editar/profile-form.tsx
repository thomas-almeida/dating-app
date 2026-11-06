"use client";

import { Film, ImagePlus } from "lucide-react";
import { useActionState, useState } from "react";
import { ChoiceChips } from "@/components/choice-chips";
import { Field, FormMessage, inputClass, textareaClass } from "@/components/field";
import { LoopVideo } from "@/components/loop-video";
import { discardMedia, EmptyTile, FilledTile, type MediaItem } from "@/components/media-tiles";
import { SubmitButton } from "@/components/submit-button";
import {
  BRAZIL_STATES,
  CHURCHES,
  MAX_HEIGHT_CM,
  MAX_PHOTOS,
  MAX_VIDEO_SECONDS,
  MIN_HEIGHT_CM,
  SKIN_COLORS,
} from "@/lib/config";
import { MediaError, uploadPhoto, uploadVideo, VIDEO_ACCEPT } from "@/lib/media-upload";
import { maskPhone } from "@/lib/phone";
import type { FormState, Gender, Hobby } from "@/lib/types";
import { saveProfile } from "./actions";
import { HobbyPicker } from "./hobby-picker";

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
  heightCm: string;
  church: string;
  skinColor: string;
  prefGenders: string[];
  prefChurches: string[];
  prefSkinColors: string[];
  whatsapp: string;
};

const initialState: FormState = { status: "idle" };

const MAX_BIO = 500;

const GENDERS: { value: Gender; label: string }[] = [
  { value: "female", label: "Mulher" },
  { value: "male", label: "Homem" },
];

const PREFERRED_GENDERS = [
  { value: "female", label: "Mulheres" },
  { value: "male", label: "Homens" },
];

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
    if (video) discardMedia(video);
    setVideo(null);
  }

  function removePhoto(item: MediaItem) {
    discardMedia(item);
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

      <section aria-labelledby="about-title" className="space-y-5">
        <div>
          <h2 id="about-title" className="font-display text-xl font-semibold">
            Sobre você
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            É opcional, mas ajuda a encontrar quem combina com você.
          </p>
        </div>

        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field label="Altura (cm)">
            <input
              type="number"
              name="height_cm"
              inputMode="numeric"
              min={MIN_HEIGHT_CM}
              max={MAX_HEIGHT_CM}
              placeholder="170"
              value={values.heightCm}
              onChange={(event) => update("heightCm", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Igreja">
            <select
              name="church"
              value={values.church}
              onChange={(event) => update("church", event.target.value)}
              className={`${inputClass} scheme-dark`}
            >
              <option value="">Prefiro não dizer</option>
              {CHURCHES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Cor da pele"
          hint="Não aparece no seu perfil: só decide em quais buscas você entra."
        >
          <select
            name="skin_color"
            value={values.skinColor}
            onChange={(event) => update("skinColor", event.target.value)}
            className={`${inputClass} scheme-dark`}
          >
            <option value="">Prefiro não dizer</option>
            {SKIN_COLORS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section aria-labelledby="preferences-title" className="space-y-5">
        <div>
          <h2 id="preferences-title" className="font-display text-xl font-semibold">
            Quem você quer ver
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Marque só o que importa. Quanto mais filtros, menos pessoas aparecem.
          </p>
        </div>

        <ChoiceChips
          name="pref_genders"
          label="Sexo"
          hint="Sem marcar nada, você vê o sexo oposto."
          options={PREFERRED_GENDERS}
          value={values.prefGenders}
          onChange={(selected) => update("prefGenders", selected)}
        />
        <ChoiceChips
          name="pref_churches"
          label="Igreja que você quer ver"
          hint="Sem marcar nada, aparecem todas."
          options={CHURCHES}
          value={values.prefChurches}
          onChange={(selected) => update("prefChurches", selected)}
        />
        <ChoiceChips
          name="pref_skin_colors"
          label="Cor da pele que você quer ver"
          hint="Sem marcar nada, aparecem todas."
          options={SKIN_COLORS}
          value={values.prefSkinColors}
          onChange={(selected) => update("prefSkinColors", selected)}
        />
      </section>

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
