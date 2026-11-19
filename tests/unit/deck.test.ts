import assert from "node:assert/strict";
import { test } from "node:test";
import { deckKey, interleaveAds } from "@/lib/deck";
import type { AdCard, DeckCard, DeckItem } from "@/lib/types";

const person = (id: string) => ({ id, displayName: id } as DeckCard);
const ad = (id: string) => ({ id, title: id } as AdCard);

const people = (total: number) =>
  Array.from({ length: total }, (_, index) => person(`p${index + 1}`));

const shape = (items: DeckItem[]) => items.map((item) => `${item.kind}:${item.id}`).join(" ");

test("sem anúncio, o deck fica só com as pessoas", () => {
  const items = interleaveAds(people(4), [], 3);
  assert.equal(shape(items), "person:p1 person:p2 person:p3 person:p4");
});

test("entra um anúncio a cada N pessoas", () => {
  const items = interleaveAds(people(7), [ad("a1"), ad("a2")], 3);
  assert.equal(
    shape(items),
    "person:p1 person:p2 person:p3 ad:a1 person:p4 person:p5 person:p6 ad:a2 person:p7",
  );
});

test("rotaciona entre os ativos antes de repetir", () => {
  const items = interleaveAds(people(10), [ad("a1"), ad("a2")], 3);
  const ads = items.flatMap((item) => (item.kind === "ad" ? [item.id] : []));
  assert.deepEqual(ads, ["a1", "a2", "a1"]);
});

test("um anúncio só é usado em todas as posições quando é o único ativo", () => {
  const items = interleaveAds(people(7), [ad("a1")], 3);
  const ads = items.flatMap((item) => (item.kind === "ad" ? [item.id] : []));
  assert.deepEqual(ads, ["a1", "a1"]);
});

// Terminar num anúncio faria o deck esvaziar com um card patrocinado na tela, e o refill
// chegaria logo depois: fica estranho e dá a impressão de que acabaram as pessoas.
test("o deck nunca termina num anúncio", () => {
  for (const total of [1, 2, 3, 6, 9, 12]) {
    const items = interleaveAds(people(total), [ad("a1"), ad("a2")], 3);
    assert.equal(items.at(-1)?.kind, "person", `total ${total}`);
  }
});

test("deck vazio continua vazio", () => {
  assert.deepEqual(interleaveAds([], [ad("a1")], 3), []);
});

test("passo inválido não divide por zero nem inverte a ordem", () => {
  const items = interleaveAds(people(3), [ad("a1")], 0);
  assert.equal(shape(items), "person:p1 ad:a1 person:p2 ad:a1 person:p3");
});

test("a chave separa pessoa de anúncio com o mesmo id", () => {
  const sameId = "00000000-0000-4000-8000-000000000001";
  assert.notEqual(
    deckKey({ kind: "person", ...person(sameId) }),
    deckKey({ kind: "ad", ...ad(sameId) }),
  );
});
