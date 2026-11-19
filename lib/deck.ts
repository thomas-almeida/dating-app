import { ADS_EVERY } from "@/lib/config";
import type { AdCard, DeckCard, DeckItem } from "@/lib/types";

// Identidade de um card no deck. Pessoa e anúncio vêm de tabelas diferentes, então o id
// sozinho não serve como chave: o kind entra junto para nunca haver colisão.
export function deckKey(item: DeckItem) {
  return `${item.kind}:${item.id}`;
}

/**
 * Intercala anúncios entre as pessoas, um a cada `every` cards.
 *
 * A lista de anúncios já chega embaralhada do `active_ads`, e aqui ela é percorrida em
 * ciclo: cada anúncio aparece uma vez antes de qualquer um repetir, o que distribui a
 * exibição entre os anunciantes em vez de sortear a mesma imagem várias vezes.
 *
 * Sem anúncios (ou para quem é Pro, que recebe lista vazia do servidor), devolve só as
 * pessoas — o deck fica exatamente como era antes.
 */
export function interleaveAds(
  people: DeckCard[],
  ads: AdCard[],
  every: number = ADS_EVERY,
): DeckItem[] {
  const step = Math.max(1, Math.trunc(every));
  const items: DeckItem[] = [];

  people.forEach((person, index) => {
    items.push({ kind: "person", ...person });

    // Nunca termina o deck num anúncio: ele só entra se ainda vem gente depois.
    const isLast = index === people.length - 1;
    if (ads.length > 0 && !isLast && (index + 1) % step === 0) {
      const ad = ads[(Math.trunc(index / step)) % ads.length];
      items.push({ kind: "ad", ...ad });
    }
  });

  return items;
}
