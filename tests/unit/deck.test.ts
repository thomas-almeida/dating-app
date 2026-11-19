import assert from "node:assert/strict";
import { test } from "node:test";
import { deckKey, interleaveAds } from "@/lib/deck";
import type { AdCard, DeckCard, DeckItem } from "@/lib/types";

const person = (id: string) => ({ id, displayName: id } as DeckCard);
const ad = (id: string) => ({ id, title: id } as AdCard);

const people = (total: number) =>
  Array.from({ length: total }, (_, index) => person(`p${index + 1}`));

const shape = (items: DeckItem[]) => items.map((item) => `${item.kind}:${item.id}`).join(" ");
const adsIn = (items: DeckItem[]) => items.flatMap((item) => (item.kind === "ad" ? [item.id] : []));

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
  assert.deepEqual(adsIn(interleaveAds(people(10), [ad("a1"), ad("a2")], 3)), ["a1", "a2", "a1"]);
});

test("um anúncio só é usado em todas as posições quando é o único ativo", () => {
  assert.deepEqual(adsIn(interleaveAds(people(7), [ad("a1")], 3)), ["a1", "a1"]);
});

// Com a base pequena o deck quase sempre tem menos gente que o passo. Pela regra do módulo
// nenhum anúncio entraria, e foi exatamente isso que aconteceu em produção: o anunciante
// estava cadastrado e ninguém via o card.
test("pool menor que o passo ainda recebe um anúncio", () => {
  assert.equal(shape(interleaveAds(people(1), [ad("a1")], 3)), "person:p1 ad:a1");
  assert.equal(shape(interleaveAds(people(2), [ad("a1")], 3)), "person:p1 person:p2 ad:a1");
});

test("pool do tamanho exato do passo recebe um anúncio", () => {
  assert.equal(
    shape(interleaveAds(people(3), [ad("a1"), ad("a2")], 3)),
    "person:p1 person:p2 person:p3 ad:a1",
  );
});

test("só um anúncio entra quando o pool é menor que o passo", () => {
  assert.deepEqual(adsIn(interleaveAds(people(2), [ad("a1"), ad("a2")], 3)), ["a1"]);
});

// Um anúncio sozinho faria o refill trazer o mesmo anúncio de novo, em loop, e a tela
// "Por agora, é só" nunca apareceria.
test("deck sem ninguém não mostra anúncio", () => {
  assert.deepEqual(interleaveAds([], [ad("a1"), ad("a2")], 3), []);
});

test("passo inválido não divide por zero", () => {
  assert.equal(
    shape(interleaveAds(people(3), [ad("a1")], 0)),
    "person:p1 ad:a1 person:p2 ad:a1 person:p3 ad:a1",
  );
});

test("a chave separa pessoa de anúncio com o mesmo id", () => {
  const sameId = "00000000-0000-4000-8000-000000000001";
  assert.notEqual(
    deckKey({ kind: "person", ...person(sameId) }),
    deckKey({ kind: "ad", ...ad(sameId) }),
  );
});
