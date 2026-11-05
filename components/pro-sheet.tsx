"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Crown, MessageCircle, Sparkles, X } from "lucide-react";
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
  useEffect(() => {
    if (!reason) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reason, onClose]);

  const copy = reason ? COPY[reason] : null;

  return (
    <AnimatePresence>
      {copy ? (
        <motion.div
          key="pro-sheet"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pro-sheet-title"
            className="pb-safe w-full max-w-md rounded-t-[2rem] bg-surface"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative px-6 pt-8 pb-6 text-center">
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-raised text-muted"
              >
                <X className="size-5" aria-hidden />
              </button>

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
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
