import type { Hobby, HobbyTag } from "@/lib/types";

type Place = { state: string | null; city: string | null };

const EMOJI_ONLY =
  /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|‍|️)+$/u;

// O teclado do iPhone costuma trazer o U+FE0F, e o tom de pele varia de pessoa para pessoa.
// Nenhum dos dois muda o gosto: 🏖 e 🏖️ são a mesma praia.
export function emojiKey(emoji: string) {
  return emoji.replace(/[️\u{1F3FB}-\u{1F3FF}]/gu, "");
}

export function isSingleEmoji(value: string) {
  const graphemes = [...new Intl.Segmenter().segment(value)];
  return graphemes.length === 1 && EMOJI_ONLY.test(value);
}

// Os padrões seguram a home se o deploy chegar antes da migration 0004: sem a coluna, vem undefined.
export function tagHobbies(mine: Hobby[] = [], theirs: Hobby[] = []): HobbyTag[] {
  const keys = new Set(mine.map(({ emoji }) => emojiKey(emoji)));
  return theirs.map((hobby) => ({ ...hobby, common: keys.has(emojiKey(hobby.emoji)) }));
}

function placeKey(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Sem a migration 0005, o bairro não vem das RPCs e fica só a cidade.
export function placeLabel({ neighborhood, city, state }: Place & { neighborhood?: string | null }) {
  if (!city || !state) return null;
  return `${neighborhood ? `${neighborhood}, ` : ""}${city} - ${state}`;
}

// A cidade é digitada: "São Paulo" e "sao paulo " precisam contar como o mesmo lugar.
export function sameRegion(mine: Place, theirs: Place) {
  if (!mine.city || !theirs.city || !mine.state || mine.state !== theirs.state) return false;
  return placeKey(mine.city) === placeKey(theirs.city);
}
