import assert from "node:assert/strict";
import { test } from "node:test";
import { emojiKey, isSingleEmoji, placeLabel, sameRegion, tagHobbies } from "@/lib/affinity";

const praia = { emoji: "🏖", hobbie: "Praia" };
const cafe = { emoji: "☕", hobbie: "Café" };
const trilha = { emoji: "🥾", hobbie: "Trilha" };

test("tagHobbies mostra todos os gostos e marca os em comum pelo emoji", () => {
  const theirs = [{ emoji: "🏖", hobbie: "Litoral" }, trilha];
  assert.deepEqual(tagHobbies([praia, cafe], theirs), [
    { emoji: "🏖", hobbie: "Litoral", common: true },
    { ...trilha, common: false },
  ]);
});

test("tagHobbies mantém os gostos mesmo sem nada em comum", () => {
  assert.deepEqual(tagHobbies([praia], [cafe]), [{ ...cafe, common: false }]);
  assert.deepEqual(tagHobbies([], [cafe]), [{ ...cafe, common: false }]);
});

test("tagHobbies não derruba a home antes da migration dos gostos", () => {
  assert.deepEqual(tagHobbies(undefined, [praia]), [{ ...praia, common: false }]);
  assert.deepEqual(tagHobbies([praia], undefined), []);
});

test("emojiKey ignora o seletor de variação do iPhone", () => {
  assert.equal(emojiKey("\u{1F3D6}️"), emojiKey("\u{1F3D6}"));
  const [tag] = tagHobbies([{ emoji: "\u{1F3D6}️", hobbie: "Praia" }], [praia]);
  assert.equal(tag.common, true);
});

test("emojiKey ignora o tom de pele", () => {
  assert.equal(emojiKey("🏃🏽"), emojiKey("🏃"));
});

test("isSingleEmoji aceita um emoji só, mesmo composto", () => {
  assert.equal(isSingleEmoji("🏖"), true);
  assert.equal(isSingleEmoji("\u{1F3D6}️"), true);
  assert.equal(isSingleEmoji("🏃🏽"), true);
  assert.equal(isSingleEmoji("👩‍🍳"), true);
  assert.equal(isSingleEmoji("🇧🇷"), true);
});

test("isSingleEmoji recusa texto e mais de um emoji", () => {
  assert.equal(isSingleEmoji(""), false);
  assert.equal(isSingleEmoji("a"), false);
  assert.equal(isSingleEmoji("🏖a"), false);
  assert.equal(isSingleEmoji("🏖🏖"), false);
});

test("placeLabel junta bairro, cidade e estado", () => {
  assert.equal(
    placeLabel({ neighborhood: "Gonzaga", city: "Santos", state: "SP" }),
    "Gonzaga, Santos - SP",
  );
});

test("placeLabel mostra só a cidade antes da migration do bairro", () => {
  assert.equal(placeLabel({ city: "Santos", state: "SP" }), "Santos - SP");
});

test("placeLabel fica vazio para quem não informou a cidade", () => {
  assert.equal(placeLabel({ neighborhood: null, city: null, state: null }), null);
});

test("sameRegion ignora acento, caixa e espaços da cidade", () => {
  const mine = { state: "SP", city: "São Paulo" };
  assert.equal(sameRegion(mine, { state: "SP", city: "sao  paulo " }), true);
});

test("sameRegion exige o mesmo estado", () => {
  assert.equal(
    sameRegion({ state: "MG", city: "Bom Jesus" }, { state: "RS", city: "Bom Jesus" }),
    false,
  );
});

test("sameRegion não conta quem não informou a cidade", () => {
  assert.equal(sameRegion({ state: "SP", city: null }, { state: "SP", city: null }), false);
  assert.equal(sameRegion({ state: null, city: "Santos" }, { state: null, city: "Santos" }), false);
});
