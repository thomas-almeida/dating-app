"use client";

import { LoaderCircle, X } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { MEDIA_BUCKET } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

export type MediaItem = { path: string; url: string };

const tileClass = "relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface";

// Só apaga na hora o que ainda não foi salvo. O resto sai quando o formulário for salvo.
export function discardMedia(item: MediaItem) {
  if (!item.url.startsWith("blob:")) return;
  URL.revokeObjectURL(item.url);
  void createClient().storage.from(MEDIA_BUCKET).remove([item.path]);
}

export function FilledTile({
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

export function EmptyTile({
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
