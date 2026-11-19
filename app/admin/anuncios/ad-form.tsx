"use client";

import { LoaderCircle } from "lucide-react";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AD_IMAGE_HEIGHT,
  AD_IMAGE_WIDTH,
  MAX_AD_DESCRIPTION,
  MAX_AD_TITLE,
} from "@/lib/config";
import { MediaError, prepareAdImage } from "@/lib/media-upload";
import { createAd } from "./actions";

const TARGET_RATIO = AD_IMAGE_WIDTH / AD_IMAGE_HEIGHT;
// Fora dessa margem a imagem perde pedaço grande no corte, então vale avisar antes de subir.
const RATIO_TOLERANCE = 0.08;

const fieldClass =
  "h-11 w-full rounded-xl bg-raised px-4 text-sm text-cream outline-none placeholder:text-muted focus:ring-2 focus:ring-coral";

type Picked = { blob: Blob; previewUrl: string; width: number; height: number };

export function AdForm() {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Avisa, mas não bloqueia: a pessoa pode ter um criativo fora do padrão e aceitar o corte.
  const ratioOff =
    picked !== null && Math.abs(picked.width / picked.height - TARGET_RATIO) > RATIO_TOLERANCE;

  async function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setNotice(null);
    try {
      const { blob, width, height } = await prepareAdImage(file);
      if (picked) URL.revokeObjectURL(picked.previewUrl);
      setPicked({ blob, previewUrl: URL.createObjectURL(blob), width, height });
    } catch (error) {
      setNotice(
        error instanceof MediaError ? error.message : "Não deu para ler essa imagem. Tente outra.",
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!picked) {
      setNotice("Escolha a imagem do anúncio.");
      return;
    }

    const form = new FormData(event.currentTarget);
    form.set("image", picked.blob, "anuncio.jpg");

    setBusy(true);
    setNotice(null);
    const result = await createAd(form);
    setBusy(false);

    if (!result.ok) {
      setNotice(result.message);
      return;
    }

    URL.revokeObjectURL(picked.previewUrl);
    setPicked(null);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3 rounded-3xl bg-surface p-5">
      <h2 className="font-display text-xl font-semibold">Novo anúncio</h2>

      <input name="title" required maxLength={MAX_AD_TITLE} placeholder="Título" className={fieldClass} />
      <input
        name="description"
        required
        maxLength={MAX_AD_DESCRIPTION}
        placeholder="Mini descrição"
        className={fieldClass}
      />
      <input
        name="targetUrl"
        type="url"
        required
        inputMode="url"
        placeholder="https://wa.me/5511... ou o link do anunciante"
        className={fieldClass}
      />

      <label className="block">
        <span className="text-sm font-semibold text-cream">Imagem</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePick}
          aria-label="Imagem do anúncio"
          className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-raised file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cream"
        />
      </label>

      <p className="text-xs leading-relaxed text-muted">
        Envie {AD_IMAGE_WIDTH}×{AD_IMAGE_HEIGHT} px (3:5). O card muda de altura conforme o
        aparelho, então mantenha logo e texto na faixa central — as bordas de cima e de baixo
        podem ser cortadas.
      </p>

      {picked && (
        <div className="flex items-start gap-3">
          {/* A proporção da caixa é a do card cheio: mostra o corte antes de publicar. */}
          <span className="relative block w-24 shrink-0 overflow-hidden rounded-xl bg-raised">
            <img src={picked.previewUrl} alt="" className="aspect-[3/5] w-full object-cover" />
          </span>
          <span className="text-xs leading-relaxed text-muted">
            {picked.width}×{picked.height} px
            {ratioOff && (
              <strong className="mt-1 block text-cream">
                Essa proporção não é 3:5. A imagem vai aparecer cortada no card.
              </strong>
            )}
          </span>
        </div>
      )}

      {notice && (
        <p role="alert" className="text-sm text-cream">
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-coral text-sm font-semibold text-ink transition disabled:opacity-60"
      >
        {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        {busy ? "Publicando" : "Publicar anúncio"}
      </button>
    </form>
  );
}
