import assert from "node:assert/strict";
import { test } from "node:test";
import { formatEventDate, fromDateInput, toDateInput } from "@/lib/event-date";

test("fromDateInput lê a hora digitada como horário de Brasília", () => {
  assert.equal(fromDateInput("2026-11-14T19:30"), "2026-11-14T22:30:00.000Z");
});

test("fromDateInput recusa o que não é data", () => {
  assert.equal(fromDateInput(""), null);
  assert.equal(fromDateInput("amanhã"), null);
  assert.equal(fromDateInput("2026-13-40T19:30"), null);
});

test("toDateInput volta para o formato do campo, em horário de Brasília", () => {
  assert.equal(toDateInput("2026-11-14T22:30:00.000Z"), "2026-11-14T19:30");
});

test("a data sobrevive à ida e à volta do formulário", () => {
  const typed = "2026-02-01T08:05";
  assert.equal(toDateInput(fromDateInput(typed) as string), typed);
});

test("formatEventDate mostra o dia e a hora de Brasília", () => {
  const text = formatEventDate("2026-11-14T22:30:00.000Z");
  assert.match(text, /14/);
  assert.match(text, /19:30/);
});
