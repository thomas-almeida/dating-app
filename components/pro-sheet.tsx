"use client";

import Link from "next/link";
import { Crown, MessageCircle, Sparkles } from "lucide-react";
import { BottomSheet } from "@/components/bottom-sheet";
import { PRO_PRICE_LABEL } from "@/lib/config";

export type ProReason = "stories" | "whatsapp";

const COPY = {
  stories: {
    title: "Stories são do Pro",
    text: "Com o Pro, você vê e curte os stories de quem te interessa.",
    icon: Sparkles,
  },
  whatsapp: {
    title: "WhatsApp é do Pro",
    text: "Assine para chamar no WhatsApp direto do perfil.",
    icon: MessageCircle,
  },
} as const;

export function ProSheet({
  reason,
  onClose,
}: {
  reason: ProReason | null;
  onClose: () => void;
}) {
  const copy = reason ? COPY[reason] : null;

  return (
    <BottomSheet open={copy !== null} onClose={onClose} labelledBy="pro-sheet-title">
      {copy ? (
        <>
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-coral/15 text-coral">
            <copy.icon className="size-6" aria-hidden />
          </span>
          <h2 id="pro-sheet-title" className="mt-4 font-display text-2xl font-semibold">
            {copy.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{copy.text}</p>

          <Link
            href="/pro"
            className="mt-6 flex h-13 items-center justify-center gap-2 rounded-full bg-coral font-semibold text-ink transition active:scale-[0.98]"
          >
            <Crown className="size-5" aria-hidden />
            Conhecer o Pro
          </Link>
          <p className="mt-3 text-xs text-muted">{PRO_PRICE_LABEL}</p>
        </>
      ) : null}
    </BottomSheet>
  );
}
