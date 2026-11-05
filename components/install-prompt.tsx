"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  Check,
  Download,
  Ellipsis,
  EllipsisVertical,
  ExternalLink,
  LogIn,
  Share,
  Smartphone,
  SquarePlus,
  type LucideIcon,
} from "lucide-react";
import { markAppInstalled } from "@/app/(app)/inicio/actions";
import { BottomSheet } from "@/components/bottom-sheet";
import {
  canPromptInstall,
  dismissInstall,
  getInstallPlatform,
  isInstalledHere,
  promptInstall,
  subscribeInstall,
  type InstallPlatform,
} from "@/lib/install";

type Guide = {
  text: string;
  steps: { icon: LucideIcon; text: React.ReactNode }[];
  note?: string;
};

const WHY =
  "Para ter a melhor experiência, deixe o app na tela inicial: ele abre em tela cheia e fica a um toque de você.";

const GUIDES: Record<InstallPlatform, Guide> = {
  ios: {
    text: WHY,
    steps: [
      {
        icon: Share,
        text: (
          <>
            Toque em <b>Compartilhar</b>, na barra do navegador. Se não estiver lá, abra antes o
            menu <b>•••</b> ou <b>≡</b>.
          </>
        ),
      },
      {
        icon: SquarePlus,
        text: (
          <>
            Role as opções e toque em <b>Adicionar à Tela de Início</b>.
          </>
        ),
      },
      {
        icon: Check,
        text: (
          <>
            Deixe <b>Abrir como app web</b> ligado, se aparecer, e toque em <b>Adicionar</b>.
          </>
        ),
      },
    ],
    // O app instalado no iPhone pode não herdar a sessão do navegador.
    note: "Depois é só abrir pelo ícone. Se pedir, entre de novo com seu e-mail e senha.",
  },
  android: {
    text: WHY,
    steps: [
      {
        icon: EllipsisVertical,
        text: (
          <>
            Toque nos <b>três pontinhos</b> do navegador, no canto da tela.
          </>
        ),
      },
      {
        icon: SquarePlus,
        text: (
          <>
            Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.
          </>
        ),
      },
      {
        icon: Check,
        text: (
          <>
            Confirme em <b>Instalar</b>.
          </>
        ),
      },
    ],
  },
  "in-app": {
    text: "Para ter a melhor experiência, deixe o app na tela inicial. Por aqui não dá: primeiro abra o site no navegador do celular.",
    steps: [
      {
        icon: Ellipsis,
        text: (
          <>
            Toque no menu deste app: <b>•••</b> ou <b>⋮</b>, em um dos cantos da tela.
          </>
        ),
      },
      {
        icon: ExternalLink,
        text: (
          <>
            Escolha <b>Abrir no navegador</b>, no <b>Safari</b> ou no <b>Chrome</b>.
          </>
        ),
      },
      { icon: LogIn, text: "Entre de novo por lá e siga os passos que vão aparecer." },
    ],
  },
};

export function InstallPrompt({ installed }: { installed: boolean }) {
  const platform = useSyncExternalStore(subscribeInstall, getInstallPlatform, () => null);
  const canPrompt = useSyncExternalStore(subscribeInstall, canPromptInstall, () => false);
  const installedHere = useSyncExternalStore(subscribeInstall, isInstalledHere, () => false);
  const guide = platform && !installed ? GUIDES[platform] : null;

  // A marca fica na conta: no iPhone, o Safari não enxerga o storage do app instalado.
  useEffect(() => {
    if (installedHere && !installed) markAppInstalled().catch(() => {});
  }, [installedHere, installed]);

  return (
    <BottomSheet open={guide !== null} onClose={dismissInstall} labelledBy="install-title">
      {guide ? (
        <>
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-coral/15 text-coral">
            <Smartphone className="size-6" aria-hidden />
          </span>
          <h2 id="install-title" className="mt-4 font-display text-2xl font-semibold">
            Adicione o app à tela inicial
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{guide.text}</p>

          {canPrompt ? (
            <button
              type="button"
              onClick={() => {
                dismissInstall();
                promptInstall();
              }}
              className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-coral font-semibold text-ink transition active:scale-[0.98]"
            >
              <Download className="size-5" aria-hidden />
              Instalar agora
            </button>
          ) : (
            <>
              <ol className="mt-5 space-y-2 text-left">
                {guide.steps.map((step, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-3 rounded-2xl bg-raised px-3 py-2.5 text-sm leading-snug"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-coral/15 text-xs font-semibold text-coral">
                      {index + 1}
                    </span>
                    <p className="flex-1">{step.text}</p>
                    <step.icon className="size-5 shrink-0 text-muted" aria-hidden />
                  </li>
                ))}
              </ol>
              {guide.note ? (
                <p className="mt-3 text-xs leading-relaxed text-muted">{guide.note}</p>
              ) : null}
            </>
          )}

          <button
            type="button"
            onClick={dismissInstall}
            className="mt-2 h-11 w-full text-sm font-semibold text-muted"
          >
            Agora não
          </button>
        </>
      ) : null}
    </BottomSheet>
  );
}
