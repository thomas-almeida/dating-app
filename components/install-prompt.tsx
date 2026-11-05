"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void> };

const DISMISSED_KEY = "install-prompt-dismissed";

const noopSubscribe = () => () => {};

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) !== null;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Sem storage, o aviso volta na próxima visita.
  }
}

function detectPlatform() {
  if (window.matchMedia("(display-mode: standalone)").matches || wasDismissed()) return "installed";
  // O Safari do iOS não tem beforeinstallprompt: a instalação é só pelo menu Compartilhar.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "other";
}

export function InstallPrompt({ className = "" }: { className?: string }) {
  const platform = useSyncExternalStore(noopSubscribe, detectPlatform, () => "installed");
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (platform === "installed" || dismissed) return null;
  if (platform === "other" && !installEvent) return null;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm ${className}`}
    >
      {installEvent ? (
        <button
          type="button"
          onClick={() => installEvent.prompt().finally(() => setInstallEvent(null))}
          className="flex flex-1 items-center gap-2 text-left font-semibold"
        >
          <Download className="size-5 shrink-0 text-coral" aria-hidden />
          Instalar o app na tela inicial
        </button>
      ) : (
        <p className="flex flex-1 items-center gap-2 text-muted">
          <Share className="size-5 shrink-0 text-coral" aria-hidden />
          Para instalar, toque em Compartilhar e depois em Adicionar à Tela de Início.
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          rememberDismissal();
          setDismissed(true);
        }}
        aria-label="Dispensar"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
