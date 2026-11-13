"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { APP_NAME, MAX_MESSAGE_LENGTH } from "@/lib/config";
import { requireMember } from "@/lib/dal";
import { emailLayout, sendEmailToUser } from "@/lib/email";
import { isPushEndpoint, notifyUser } from "@/lib/push";
import { siteOrigin } from "@/lib/site";
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

  const origin = await siteOrigin();

  // O texto fica de fora: a notificação aparece na tela bloqueada.
  after(() =>
    Promise.all([
      notifyUser(parsed.data.to, {
        title: APP_NAME,
        body: `${profile.nickname ?? profile.name} te mandou uma mensagem`,
        url: `/conversas/${user.id}`,
        tag: `chat-${user.id}`,
      }),
      sendEmailToUser(parsed.data.to, {
        subject: `${profile.nickname ?? profile.name} te enviou uma mensagem`,
        text: `${profile.nickname ?? profile.name} te enviou uma mensagem no ${APP_NAME}. Abra o app para responder.`,
        html: emailLayout({
          preheader: `${profile.nickname ?? profile.name} te enviou uma mensagem.`,
          title: "Você recebeu uma mensagem",
          paragraphs: [
            `${profile.nickname ?? profile.name} te enviou uma mensagem no ${APP_NAME}.`,
            "Abra o app para responder.",
          ],
          button: { label: "Abrir conversa", url: `${origin}/conversas/${user.id}` },
        }),
      }),
    ]),
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
