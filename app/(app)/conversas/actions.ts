"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { APP_NAME, MAX_MESSAGE_LENGTH } from "@/lib/config";
import { requireMember } from "@/lib/dal";
import { isPushEndpoint, notifyUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const messageSchema = z.object({
  to: z.uuid(),
  body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

const subscriptionSchema = z.object({
  endpoint: z.string().refine(isPushEndpoint),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function sendMessage(to: string, body: string): Promise<{ ok: boolean }> {
  const parsed = messageSchema.safeParse({ to, body });
  if (!parsed.success) return { ok: false };

  const { user, profile } = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_message", {
    p_to: parsed.data.to,
    p_body: parsed.data.body,
  });

  if (error) {
    console.error("sendMessage", error);
    return { ok: false };
  }

  // O texto fica de fora: a notificação aparece na tela bloqueada.
  after(() =>
    notifyUser(parsed.data.to, {
      title: APP_NAME,
      body: `${profile.nickname ?? profile.name} te mandou uma mensagem`,
      url: `/conversas/${user.id}`,
      tag: `chat-${user.id}`,
    }),
  );

  revalidatePath("/matches");
  return { ok: true };
}

export async function markChatRead(other: string) {
  if (!z.uuid().safeParse(other).success) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_chat_read", { p_with: other });
  if (error) console.error("markChatRead", error);

  revalidatePath("/matches");
}

export async function savePushSubscription(subscription: unknown): Promise<{ ok: boolean }> {
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false };

  const { user } = await requireMember();
  const { endpoint, keys } = parsed.data;

  // O aparelho é um só: se outra conta entrar nele, a notificação passa a ser dela.
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert({ endpoint, user_id: user.id, p256dh: keys.p256dh, auth: keys.auth });

  if (error) {
    console.error("savePushSubscription", error);
    return { ok: false };
  }
  return { ok: true };
}
