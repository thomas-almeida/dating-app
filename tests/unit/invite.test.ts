import assert from "node:assert/strict";
import { test } from "node:test";
import { INVITE_TTL_DAYS } from "@/lib/config";
import { createInvite, hashInviteToken } from "@/lib/invite";

const DAY_MS = 24 * 60 * 60 * 1000;

test("o convite guarda o hash, não o token", () => {
  const invite = createInvite();
  assert.notEqual(invite.hash, invite.token);
  assert.equal(invite.hash, hashInviteToken(invite.token));
});

test("cada convite tem um token diferente", () => {
  assert.notEqual(createInvite().token, createInvite().token);
});

test("o token cabe numa URL sem escape", () => {
  assert.match(createInvite().token, /^[A-Za-z0-9_-]{32,}$/);
});

test("o convite vence no prazo configurado", () => {
  const remaining = new Date(createInvite().expiresAt).getTime() - Date.now();
  assert.ok(Math.abs(remaining - INVITE_TTL_DAYS * DAY_MS) < 60_000);
});
