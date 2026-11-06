"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { savePushSubscription } from "@/app/(app)/conversas/actions";
import { detectInstallPlatform, isInstalledHere } from "@/lib/install";

type PushState = "hidden" | "ask" | "install";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function decodeKey(key: string) {
  const padded = `${key}${"=".repeat((4 - (key.length % 4)) % 4)}`;
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function readState(): Promise<PushState> {
  if (!PUBLIC_KEY) return "hidden";

  if (!("Notification" in window) || !("PushManager" in window)) {
    // O Safari do iPhone só libera notificações para o app instalado na tela inicial.
    const onIphone = detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints) === "ios";
    return onIphone && !isInstalledHere() ? "install" : "hidden";
  }

  if (Notification.permission === "denied") return "hidden";

  const registration = await navigator.serviceWorker?.getRegistration();
  if (!registration) return "hidden";

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return "ask";

  // Quem entrou em outra conta no mesmo aparelho passa a receber as notificações dela.
  await savePushSubscription(subscription.toJSON()).catch(() => {});
  return "hidden";
}

export function PushPrompt() {
  const [state, setState] = useState<PushState>("hidden");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    readState()
      .then(setState)
      .catch(() => {});
  }, []);

  // Precisa vir de um toque: o navegador recusa pedir permissão sozinho.
  async function enable() {
    setFailed(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("hidden");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(PUBLIC_KEY ?? ""),
      });
      const result = await savePushSubscription(subscription.toJSON());
      if (!result.ok) throw new Error("Inscrição recusada");
      setState("hidden");
    } catch {
      setFailed(true);
    }
  }

  if (state === "hidden") return null;

  return (
    <section
      aria-label="Notificações"
      className="mb-3 flex items-center gap-3 rounded-3xl bg-surface p-4"
    >
      <Bell className="size-5 shrink-0 text-coral" aria-hidden />
      {state === "install" ? (
        <p className="text-sm leading-relaxed text-muted">
          No iPhone, as notificações só funcionam com o app na tela inicial.
        </p>
      ) : (
        <>
          <p className="flex-1 text-sm leading-relaxed text-muted">
            {failed
              ? "Não deu para ativar. Tente de novo."
              : "Quer saber quando chegar um match ou uma mensagem?"}
          </p>
          <button
            type="button"
            onClick={enable}
            className="h-10 shrink-0 rounded-full bg-cream px-4 text-sm font-semibold text-ink"
          >
            Ativar
          </button>
        </>
      )}
    </section>
  );
}
