import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushMessage = { title: string; body: string; url: string; tag: string };

const DAY_SECONDS = 24 * 60 * 60;

const PUSH_HOSTS =
  /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;

// O endereço vem do navegador e o servidor faz POST nele: sem isso, daria para apontar para a rede interna.
export function isPushEndpoint(value: string) {
  try {
    const { protocol, hostname } = new URL(value);
    return protocol === "https:" && PUSH_HOSTS.test(hostname);
  } catch {
    return false;
  }
}

function vapidDetails() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

// Nunca derruba quem chamou: a mensagem já foi gravada, e a notificação é só um aviso.
export async function notifyUser(userId: string, message: PushMessage) {
  const vapid = vapidDetails();
  if (!vapid) return;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (error) {
      console.error("notifyUser", error);
      return;
    }

    await Promise.all(
      (data ?? []).map(async ({ endpoint, p256dh, auth }) => {
        const request = webpush.generateRequestDetails(
          { endpoint, keys: { p256dh, auth } },
          JSON.stringify(message),
          { vapidDetails: vapid, TTL: DAY_SECONDS },
        );
        const response = await fetch(request.endpoint, {
          method: request.method,
          headers: request.headers,
          body: request.body as BodyInit,
        });

        // O serviço avisa quando a pessoa desinstalou ou revogou a permissão.
        if (response.status === 404 || response.status === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
        } else if (!response.ok) {
          console.error("notifyUser", response.status);
        }
      }),
    );
  } catch (error) {
    console.error("notifyUser", error);
  }
}
