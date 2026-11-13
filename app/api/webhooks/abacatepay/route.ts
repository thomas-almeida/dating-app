import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { verifyWebhookSecret, verifyWebhookSignature } from "@/lib/abacatepay";
import { emailLayout, sendEmailToUser } from "@/lib/email";
import { siteOrigin } from "@/lib/site";
import { closeSubscription } from "@/lib/subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Subscription } from "@/lib/types";

type Json = Record<string, unknown>;

type SubscriptionRow = Pick<
  Subscription,
  "id" | "user_id" | "status" | "subscription_id" | "customer_id"
>;

const ROW_COLUMNS = "id, user_id, status, subscription_id, customer_id";

const ACTIVATING = new Set([
  "subscription.completed",
  "subscription.renewed",
  "subscription.trial_started",
  "checkout.completed",
]);

const ENDING = new Set(["subscription.cancelled", "checkout.refunded", "checkout.disputed"]);

const uuidSchema = z.uuid();

function asObject(value: unknown): Json {
  return typeof value === "object" && value !== null ? (value as Json) : {};
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

// O formato de data não é documentado para assinaturas: procura em todos os lugares conhecidos.
async function findRow(admin: SupabaseClient, data: Json): Promise<SubscriptionRow | null> {
  const subscription = asObject(data.subscription);
  const checkout = asObject(data.checkout);
  const customer = asObject(data.customer);
  const metadata = { ...asObject(data.metadata), ...asObject(checkout.metadata) };

  const externalId = asText(data.externalId) ?? asText(checkout.externalId);
  const userId = asText(metadata.userId);

  const lookups: [string, unknown][] = [
    ["checkout_id", subscription.checkoutId],
    ["checkout_id", checkout.id],
    ["checkout_id", data.checkoutId],
    ["checkout_id", data.id],
    ["id", uuidSchema.safeParse(externalId).success ? externalId : null],
    ["user_id", uuidSchema.safeParse(userId).success ? userId : null],
    ["subscription_id", subscription.id],
    ["subscription_id", data.id],
    ["customer_id", subscription.customerId],
    ["customer_id", customer.id],
    ["customer_id", data.customerId],
  ];

  for (const [column, value] of lookups) {
    const text = asText(value);
    if (!text) continue;

    const { data: row, error } = await admin
      .from("subscriptions")
      .select(ROW_COLUMNS)
      .eq(column, text)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (row) return row as SubscriptionRow;
  }

  return null;
}

async function activate(admin: SupabaseClient, row: SubscriptionRow, data: Json) {
  // Quem cancelou no app não volta a ser Pro por um evento atrasado.
  if (row.status === "cancelled") return;

  const subscription = asObject(data.subscription);
  const dataId = asText(data.id);

  const { error } = await admin
    .from("subscriptions")
    .update({
      status: "active",
      subscription_id:
        asText(subscription.id) ??
        (dataId?.startsWith("subs_") ? dataId : null) ??
        row.subscription_id,
      customer_id:
        asText(subscription.customerId) ??
        asText(asObject(data.customer).id) ??
        asText(data.customerId) ??
        row.customer_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (error) throw error;

  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_pro: true })
    .eq("id", row.user_id);
  if (profileError) throw profileError;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const { searchParams } = new URL(request.url);

  const trusted =
    verifyWebhookSecret(searchParams.get("webhookSecret")) &&
    verifyWebhookSignature(rawBody, request.headers.get("x-webhook-signature"));

  if (!trusted) return new Response("Unauthorized", { status: 401 });

  let body: Json;
  try {
    body = asObject(JSON.parse(rawBody));
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const id = asText(body.id);
  const event = asText(body.event);
  if (!id || !event) return new Response("Bad request", { status: 400 });

  const data = asObject(body.data);

  // Erro aqui responde 500 de propósito: é o que faz o AbacatePay tentar de novo.
  try {
    const admin = createAdminClient();

    const { data: stored, error: storedError } = await admin
      .from("payment_events")
      .select("processed_at")
      .eq("id", id)
      .maybeSingle();
    if (storedError) throw storedError;
    if (stored?.processed_at) return Response.json({ ok: true });

    if (!stored) {
      const { error } = await admin
        .from("payment_events")
        .insert({ id, event, dev_mode: body.devMode === true, payload: body });
      // 23505: a reentrega chegou junto com a primeira.
      if (error && error.code !== "23505") throw error;
    }

    const row = await findRow(admin, data);

    // Sem casamento, o evento fica guardado sem processed_at para conferência manual.
    if (!row) {
      console.warn("Webhook sem assinatura correspondente", id, event);
      return Response.json({ ok: true });
    }

    if (ACTIVATING.has(event)) {
      await activate(admin, row, data);
      const origin = await siteOrigin();
      after(() =>
        sendEmailToUser(row.user_id, {
          subject: "Pagamento confirmado: seu Pro está ativo",
          text: "Seu pagamento foi confirmado e o plano Pro já está ativo.",
          html: emailLayout({
            preheader: "Seu pagamento foi confirmado.",
            title: "Seu Pro está ativo",
            paragraphs: ["Seu pagamento foi confirmado.", "Seu plano Pro já está ativo."],
            button: { label: "Abrir o Ágape", url: `${origin}/pro` },
          }),
        }),
      );
    } else if (ENDING.has(event)) {
      await closeSubscription(row);
      const origin = await siteOrigin();
      after(() =>
        sendEmailToUser(row.user_id, {
          subject: "Atualização da sua assinatura Pro",
          text: "Sua assinatura Pro foi encerrada ou teve um problema no pagamento. Confira os detalhes no app.",
          html: emailLayout({
            preheader: "Atualização importante sobre sua assinatura.",
            title: "Atualização da assinatura",
            paragraphs: [
              "Sua assinatura Pro foi encerrada ou teve um problema no pagamento.",
              "Confira os detalhes no app.",
            ],
            button: { label: "Ver assinatura", url: `${origin}/pro` },
          }),
        }),
      );
    }

    const { error } = await admin
      .from("payment_events")
      .update({ processed_at: new Date().toISOString(), user_id: row.user_id })
      .eq("id", id);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Webhook AbacatePay", error);
    return new Response("Internal error", { status: 500 });
  }
}
