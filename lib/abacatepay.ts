import "server-only";
import crypto from "node:crypto";

// Chave pública publicada na documentação do AbacatePay. Não é segredo da conta.
const ABACATEPAY_PUBLIC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

function apiUrl() {
  return process.env.ABACATEPAY_API_URL ?? "https://api.abacatepay.com/v2";
}

export function isAbacatePayConfigured() {
  return Boolean(process.env.ABACATEPAY_API_KEY && process.env.ABACATEPAY_PRO_PRODUCT_ID);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as {
    data: T;
    error: unknown;
    success: boolean;
  } | null;

  if (!response.ok || !json?.success) {
    throw new Error(`AbacatePay ${path}: ${response.status} ${JSON.stringify(json?.error ?? null)}`);
  }
  return json.data;
}

export function createSubscriptionCheckout(input: {
  externalId: string;
  userId: string;
  completionUrl: string;
  returnUrl: string;
}) {
  return post<{ id: string; url: string }>("/subscriptions/create", {
    items: [{ id: process.env.ABACATEPAY_PRO_PRODUCT_ID, quantity: 1 }],
    externalId: input.externalId,
    completionUrl: input.completionUrl,
    returnUrl: input.returnUrl,
    methods: ["CARD"],
    metadata: { userId: input.userId },
  });
}

// Efeito imediato e irreversível: o AbacatePay não dá carência até o fim do ciclo.
export function cancelSubscription(subscriptionId: string) {
  return post<{ id: string; status: string }>("/subscriptions/cancel", { id: subscriptionId });
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyWebhookSecret(received: string | null) {
  const expected = process.env.ABACATEPAY_WEBHOOK_SECRET;
  return Boolean(expected && received && safeEqual(received, expected));
}

export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", ABACATEPAY_PUBLIC_KEY)
    .update(Buffer.from(rawBody, "utf8"))
    .digest("base64");
  return safeEqual(expected, signature);
}
