"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  cancelSubscription,
  createSubscriptionCheckout,
  isAbacatePayConfigured,
} from "@/lib/abacatepay";
import { requireMember } from "@/lib/dal";
import { siteOrigin } from "@/lib/site";
import { closeSubscription } from "@/lib/subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/lib/types";

const CHECKOUT_FAILED: FormState = {
  status: "error",
  message: "Não deu para abrir o pagamento. Tente de novo.",
};

const CANCEL_FAILED: FormState = {
  status: "error",
  message: "Não deu para cancelar agora. Tente de novo.",
};

export async function startCheckout(): Promise<FormState> {
  const { user, profile } = await requireMember();
  if (profile.is_pro) redirect("/pro");
  if (!isAbacatePayConfigured()) return CHECKOUT_FAILED;

  const admin = createAdminClient();

  // A linha nasce antes do checkout: é o id dela que volta no webhook.
  const { data: row, error } = await admin
    .from("subscriptions")
    .insert({ user_id: user.id })
    .select("id")
    .single();

  if (error) {
    console.error("startCheckout", error);
    return CHECKOUT_FAILED;
  }

  const origin = await siteOrigin();
  let checkoutUrl: string;

  try {
    const checkout = await createSubscriptionCheckout({
      externalId: row.id,
      userId: user.id,
      completionUrl: `${origin}/pro?status=ok`,
      returnUrl: `${origin}/pro`,
    });

    const { error: updateError } = await admin
      .from("subscriptions")
      .update({ checkout_id: checkout.id })
      .eq("id", row.id);
    if (updateError) throw updateError;

    checkoutUrl = checkout.url;
  } catch (checkoutError) {
    console.error("startCheckout", checkoutError);
    await admin.from("subscriptions").delete().eq("id", row.id);
    return CHECKOUT_FAILED;
  }

  redirect(checkoutUrl);
}

export async function cancelPro(): Promise<FormState> {
  const { user } = await requireMember();
  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("subscriptions")
    .select("id, user_id, subscription_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("cancelPro", error);
    return CANCEL_FAILED;
  }

  // O id da assinatura só chega pelo webhook.
  if (!row?.subscription_id) {
    return {
      status: "error",
      message: "Sua assinatura ainda está sendo confirmada. Tente de novo em alguns minutos.",
    };
  }

  try {
    await cancelSubscription(row.subscription_id);
    // Não espera o webhook: quem cancelou precisa ver o resultado na hora.
    await closeSubscription(row);
  } catch (cancelError) {
    console.error("cancelPro", cancelError);
    return CANCEL_FAILED;
  }

  revalidatePath("/", "layout");
  return { status: "ok" };
}
