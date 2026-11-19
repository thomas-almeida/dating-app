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
 * Com a base pequena o deck costuma ter menos gente que o passo, e nesse caso nenhum
 * anúncio entraria pela regra do módulo. Por isso, quando o deck tem gente mas nenhum
 * anúncio couber, um é acrescentado no fim.
 *
 * Deck sem ninguém devolve nada, nem anúncio: o card de anúncio sozinho faria o `refill`
 * do deck trazer o mesmo anúncio de novo, em loop infinito, e a tela "Por agora, é só"
 * nunca apareceria.
 */
export function interleaveAds(
  people: DeckCard[],
  ads: AdCard[],
  every: number = ADS_EVERY,
): DeckItem[] {
  const onlyPeople = () => people.map((person): DeckItem => ({ kind: "person", ...person }));

  // Para quem é Pro o servidor devolve lista vazia, então o deck fica igual ao de antes.
  if (ads.length === 0 || people.length === 0) return onlyPeople();

  const step = Math.max(1, Math.trunc(every));
  const items: DeckItem[] = [];
  let used = 0;

  people.forEach((person, index) => {
    items.push({ kind: "person", ...person });

    if ((index + 1) % step === 0) {
      items.push({ kind: "ad", ...ads[used % ads.length] });
      used += 1;
    }
  });

  if (used === 0) items.push({ kind: "ad", ...ads[0] });

  return items;
}
