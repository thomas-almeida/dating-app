"use client";

import { Heart, MessageCircle } from "lucide-react";
import { motion, MotionConfig } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { GradientBackground } from "@/components/gradient-background";
import { HobbyTags } from "@/components/hobby-tags";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { APP_NAME } from "@/lib/config";
import { whatsappUrl } from "@/lib/phone";
import type { DeckCard } from "@/lib/types";

export type MatchViewer = { name: string; photoUrl: string | null; isPro: boolean };

const TITLE = "Deu match!";
const HEARTS_PER_BURST = 14;
const BURST_SECONDS = 1.1;

function HeartBurst({ id, onDone }: { id: number; onDone: () => void }) {
  return Array.from({ length: HEARTS_PER_BURST }, (_, index) => {
    // Cada explosão gira um pouco, para os corações não saírem sempre no mesmo lugar.
    const angle = (index / HEARTS_PER_BURST) * Math.PI * 2 + id * 0.35;
    const distance = 110 + (index % 3) * 50;

    return (
      <motion.span
        key={index}
        aria-hidden
        // Só coral some no fundo, que é da mesma cor.
        className={`pointer-events-none absolute ${index % 2 ? "text-cream" : "text-coral"}`}
        initial={{ x: 0, y: 0, scale: 0.3, opacity: 1 }}
        animate={{
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          scale: 1 + (index % 2) * 0.5,
          opacity: 0,
        }}
        transition={{ duration: BURST_SECONDS, ease: "easeOut" }}
        onAnimationComplete={index === 0 ? onDone : undefined}
      >
        <Heart className="size-5 fill-current" />
      </motion.span>
    );
  });
}

// Dá para puxar a foto: ela volta para o lugar com elástico.
function Portrait({
  label,
  photoUrl,
  side,
}: {
  label: string;
  photoUrl: string | null;
  side: -1 | 1;
}) {
  return (
    <motion.div
      drag
      dragSnapToOrigin
      dragElastic={0.45}
      whileDrag={{ scale: 1.06 }}
      initial={{ x: side * 260, rotate: side * 28, opacity: 0 }}
      animate={{ x: side * 4, rotate: side * 7, opacity: 1 }}
      transition={{ type: "spring", damping: 13, stiffness: 150 }}
      className="relative size-36 shrink-0 cursor-grab touch-none overflow-hidden rounded-full bg-linear-to-b from-raised to-coral-deep/50 ring-4 ring-cream active:cursor-grabbing"
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          draggable={false}
          className="pointer-events-none size-full object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center font-display text-5xl font-semibold text-cream">
          {label.charAt(0)}
        </span>
      )}
    </motion.div>
  );
}

export function MatchOverlay({
  card,
  whatsapp,
  viewer,
  onClose,
}: {
  card: DeckCard;
  whatsapp: string | null;
  viewer: MatchViewer;
  onClose: () => void;
}) {
  const [bursts, setBursts] = useState([0]);
  const nextBurst = useRef(1);

  function celebrate() {
    navigator.vibrate?.(30);
    const id = nextBurst.current;
    nextBurst.current += 1;
    setBursts((current) => [...current, id]);
  }

  const href = whatsapp
    ? whatsappUrl(whatsapp, `Oi, ${card.displayName}! Deu match no ${APP_NAME}.`)
    : null;
  // Sem número e sem Pro, o botão abre o plano. Com Pro, só falta o contato da pessoa.
  const canMessage = href !== null || !viewer.isPro;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="pt-safe pb-safe fixed inset-0 isolate z-50 flex flex-col items-center justify-center overflow-hidden bg-ink px-8 text-center"
      >
        <GradientBackground />

        <div className="relative flex items-center justify-center">
          <Portrait label={viewer.name} photoUrl={viewer.photoUrl} side={-1} />
          <div className="-ml-7">
            <Portrait label={card.displayName} photoUrl={card.posterUrl} side={1} />
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {bursts.map((id) => (
              <HeartBurst
                key={id}
                id={id}
                onDone={() => setBursts((current) => current.filter((item) => item !== id))}
              />
            ))}
            <motion.button
              type="button"
              aria-label="Soltar corações"
              onClick={celebrate}
              animate={{ scale: [1, 1.14, 1] }}
              whileTap={{ scale: 0.8 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-coral text-ink shadow-lg shadow-black/40"
            >
              <Heart className="size-6 fill-current" aria-hidden />
            </motion.button>
          </div>
        </div>

        <h2
          id="match-title"
          aria-label={TITLE}
          className="mt-8 font-display text-5xl font-semibold"
        >
          {[...TITLE].map((letter, index) => (
            <motion.span
              key={index}
              aria-hidden
              className="inline-block"
              initial={{ y: 30, rotate: -10, opacity: 0 }}
              animate={{ y: 0, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 11, stiffness: 240, delay: 0.3 + index * 0.04 }}
            >
              {letter === " " ? " " : letter}
            </motion.span>
          ))}
        </h2>

        {/* Só opacidade: um transform aqui prenderia o ProSheet do botão do WhatsApp nesta caixa. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.4 }}
          className="w-full max-w-xs"
        >
          <p className="mt-2 text-sm leading-relaxed text-cream">
            Você e {card.displayName} se curtiram.
          </p>

          <div className="mt-3 flex flex-wrap justify-center gap-1.5 empty:hidden">
            <HobbyTags
              hobbies={card.hobbies}
              sameRegion={card.sameRegion}
              church={card.church}
              sameChurch={card.sameChurch}
            />
          </div>

          <div className="mt-7 space-y-2">
            <Link
              href={`/conversas/${card.id}`}
              className="flex h-13 items-center justify-center gap-2 rounded-full bg-coral font-semibold text-ink transition active:scale-[0.98]"
            >
              <MessageCircle className="size-5" aria-hidden />
              Abrir conversa
            </Link>
            {canMessage && <WhatsAppButton href={href} />}
            <Link
              href={`/perfil/${card.id}`}
              className="flex h-13 items-center justify-center rounded-full bg-surface font-semibold text-cream"
            >
              Ver perfil
            </Link>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="h-11 w-full text-sm font-semibold text-cream"
            >
              Continuar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
}
