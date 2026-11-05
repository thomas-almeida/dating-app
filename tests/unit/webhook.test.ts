import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { isAbacatePayConfigured, verifyWebhookSecret, verifyWebhookSignature } from "@/lib/abacatepay";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

test("verifyWebhookSecret aceita só o segredo configurado", () => {
  process.env.ABACATEPAY_WEBHOOK_SECRET = "segredo-certo";
  assert.equal(verifyWebhookSecret("segredo-certo"), true);
  assert.equal(verifyWebhookSecret("segredo-errad"), false);
  assert.equal(verifyWebhookSecret("curto"), false);
  assert.equal(verifyWebhookSecret(null), false);
});

test("verifyWebhookSecret recusa tudo quando não há segredo configurado", () => {
  delete process.env.ABACATEPAY_WEBHOOK_SECRET;
  assert.equal(verifyWebhookSecret("qualquer"), false);
  assert.equal(verifyWebhookSecret(""), false);
});

test("verifyWebhookSignature recusa assinatura ausente ou errada", () => {
  assert.equal(verifyWebhookSignature("{}", null), false);
  assert.equal(verifyWebhookSignature("{}", "assinatura-falsa"), false);
});

test("isAbacatePayConfigured exige a chave e o produto", () => {
  process.env.ABACATEPAY_API_KEY = "chave";
  delete process.env.ABACATEPAY_PRO_PRODUCT_ID;
  assert.equal(isAbacatePayConfigured(), false);

  process.env.ABACATEPAY_PRO_PRODUCT_ID = "prod_1";
  assert.equal(isAbacatePayConfigured(), true);
});
