"use client";

import { Plus, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { FormMessage, inputClass } from "@/components/field";
import { emojiKey, isSingleEmoji } from "@/lib/affinity";
import { MAX_HOBBIES } from "@/lib/config";
import type { Hobby } from "@/lib/types";

// Os gostos em comum vêm do emoji: quanto mais gente escolhe daqui, mais gente combina.
const SUGGESTIONS: Hobby[] = [
  { emoji: "🏖️", hobbie: "Praia" },
  { emoji: "🙌", hobbie: "Louvor" },
  { emoji: "📖", hobbie: "Leitura" },
  { emoji: "☕", hobbie: "Café" },
  { emoji: "🥾", hobbie: "Trilha" },
  { emoji: "⚽", hobbie: "Futebol" },
  { emoji: "🎬", hobbie: "Filmes" },
  { emoji: "✈️", hobbie: "Viagens" },
  { emoji: "🍳", hobbie: "Cozinhar" },
  { emoji: "🎮", hobbie: "Games" },
  { emoji: "🐶", hobbie: "Pets" },
  { emoji: "🎵", hobbie: "Música" },
  { emoji: "🏋️", hobbie: "Academia" },
  { emoji: "🚴", hobbie: "Pedal" },
  { emoji: "🤝", hobbie: "Voluntariado" },
  { emoji: "🎨", hobbie: "Arte" },
];

const MAX_HOBBY_NAME = 30;

export function HobbyPicker({
  value,
  onChange,
}: {
  value: Hobby[];
  onChange: (hobbies: Hobby[]) => void;
}) {
  const [emoji, setEmoji] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  const picked = (candidate: string) =>
    value.some((hobby) => emojiKey(hobby.emoji) === emojiKey(candidate));
  const full = value.length >= MAX_HOBBIES;

  function addCustom() {
    const nextEmoji = emoji.trim();
    const nextName = name.trim();

    if (!isSingleEmoji(nextEmoji)) return setError("Use um emoji só.");
    if (!nextName) return setError("Dê um nome para esse gosto.");
    if (picked(nextEmoji)) return setError("Você já escolheu esse emoji.");

    onChange([...value, { emoji: nextEmoji, hobbie: nextName }]);
    setEmoji("");
    setName("");
    setError(undefined);
  }

  // Dentro do form, o Enter enviaria o perfil inteiro.
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addCustom();
  }

  return (
    <section aria-labelledby="hobbies-title">
      <div className="mb-1.5 flex items-baseline justify-between">
        <h2 id="hobbies-title" className="text-sm font-medium text-cream">
          Gostos
        </h2>
        <span className="text-xs text-muted">
          {value.length} de {MAX_HOBBIES}
        </span>
      </div>

      <input type="hidden" name="hobbies" value={JSON.stringify(value)} />

      {value.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {value.map((hobby) => (
            <li key={hobby.emoji}>
              <button
                type="button"
                aria-label={`Remover ${hobby.hobbie}`}
                onClick={() => onChange(value.filter((item) => item !== hobby))}
                className="flex h-10 items-center gap-1.5 rounded-full bg-coral pr-2.5 pl-3.5 text-sm font-semibold text-ink"
              >
                <span aria-hidden>{hobby.emoji}</span>
                {hobby.hobbie}
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ul className="flex flex-wrap gap-2">
        {SUGGESTIONS.filter(({ emoji: candidate }) => !picked(candidate)).map((hobby) => (
          <li key={hobby.emoji}>
            <button
              type="button"
              disabled={full}
              onClick={() => onChange([...value, hobby])}
              className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm text-cream transition disabled:opacity-40"
            >
              <span aria-hidden>{hobby.emoji}</span>
              {hobby.hobbie}
            </button>
          </li>
        ))}
      </ul>

      {!full && (
        <div className="mt-3 flex gap-2">
          <input
            aria-label="Emoji do gosto"
            placeholder="😀"
            maxLength={16}
            value={emoji}
            onChange={(event) => setEmoji(event.target.value)}
            onKeyDown={handleKeyDown}
            className={`${inputClass} w-16! shrink-0 px-0 text-center`}
          />
          <input
            aria-label="Nome do gosto"
            placeholder="Outro gosto"
            maxLength={MAX_HOBBY_NAME}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={handleKeyDown}
            className={`${inputClass} min-w-0 flex-1`}
          />
          <button
            type="button"
            aria-label="Adicionar gosto"
            onClick={addCustom}
            className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-raised text-cream"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
      )}

      <p className="mt-1.5 text-xs text-muted">
        Quem tiver um emoji igual ao seu aparece com gostos em comum.
      </p>

      {error && (
        <div className="mt-3">
          <FormMessage message={error} />
        </div>
      )}
    </section>
  );
}
