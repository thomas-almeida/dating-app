"use client";

import { useEffect, useState } from "react";
import { UPDATE_CHECK_MS } from "@/lib/config";

// Fica gravada no código deste deploy. O /api/version responde a do deploy mais novo.
const CURRENT_VERSION = process.env.NEXT_PUBLIC_DEPLOYMENT_ID;

const RELOADED_KEY = "app-update-reloaded";

async function latestVersion(): Promise<string | null> {
  const response = await fetch("/api/version", { cache: "no-store" });
  if (!response.ok) return null;
  const { version } = await response.json();
  return version;
}

// Recarregar apagaria o rascunho de uma mensagem ou de um perfil.
function hasVisibleForm() {
  return [...document.forms].some((form) => form.offsetParent !== null);
}

// Uma vez por versão: se o deploy novo demorar a chegar aqui, a tela não entra em loop.
function reloadOnce(version: string) {
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === version) return false;
    sessionStorage.setItem(RELOADED_KEY, version);
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function UpdatePrompt() {
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    if (!CURRENT_VERSION) return;

    async function check(resumed: boolean) {
      if (document.visibilityState !== "visible") return;

      // Sem navegação, o navegador não procura um service worker novo sozinho.
      navigator.serviceWorker
        ?.getRegistration()
        .then((registration) => registration?.update())
        .catch(() => {});

      const version = await latestVersion().catch(() => null);
      if (!version || version === CURRENT_VERSION) return;

      // Quem acabou de voltar para o app não perde nada. Quem está usando decide a hora.
      if (resumed && !hasVisibleForm() && reloadOnce(version)) return;
      setOutdated(true);
    }

    const onVisibilityChange = () => void check(true);
    const timer = setInterval(() => void check(false), UPDATE_CHECK_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  if (!outdated) return null;

  return (
    <div role="status" className="pt-safe fixed inset-x-0 top-0 z-[60] px-4">
      <div className="mx-auto mt-2 flex max-w-md items-center gap-3 rounded-full bg-cream py-1.5 pr-1.5 pl-4 text-sm font-semibold text-ink shadow-lg shadow-black/40">
        <span className="flex-1">Tem uma versão nova do app</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-9 rounded-full bg-ink px-4 text-cream"
        >
          Atualizar
        </button>
      </div>
    </div>
  );
}
