import assert from "node:assert/strict";
import { test } from "node:test";
import { displayPhone, maskPhone, normalizePhone } from "@/lib/phone";

test("normalizePhone coloca o 55 em DDD + número", () => {
  assert.equal(normalizePhone("(11) 91234-5678"), "5511912345678");
  assert.equal(normalizePhone("11 3456-7890"), "551134567890");
});

test("normalizePhone mantém quem já tem o 55", () => {
  assert.equal(normalizePhone("+55 11 91234-5678"), "5511912345678");
  assert.equal(normalizePhone("551134567890"), "551134567890");
});

test("normalizePhone recusa o que não é telefone do Brasil", () => {
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone("1199"), null);
  assert.equal(normalizePhone("1211912345678"), null);
  assert.equal(normalizePhone("119123456789012"), null);
});

test("maskPhone formata enquanto a pessoa digita", () => {
  assert.equal(maskPhone(""), "");
  assert.equal(maskPhone("1"), "(1");
  assert.equal(maskPhone("119"), "(11) 9");
  assert.equal(maskPhone("1134567890"), "(11) 3456-7890");
  assert.equal(maskPhone("11912345678"), "(11) 91234-5678");
});

test("maskPhone ignora letras e o que passa de 11 dígitos", () => {
  assert.equal(maskPhone("11a9b1234567899"), "(11) 91234-5678");
});

test("displayPhone tira o 55 para exibir no formulário", () => {
  assert.equal(displayPhone("5511912345678"), "(11) 91234-5678");
  assert.equal(displayPhone("11912345678"), "(11) 91234-5678");
});
