"use client";

import { BadgeCheck, ChevronRight, Heart, LoaderCircle, RefreshCw, Video, X } from "lucide-react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from "react";
import { LoopVideo } from "@/components/loop-video";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/config";
import type { DeckCard, SwipeAction } from "@/lib/types";
import { loadMoreCards, recordSwipe } from "./actions";

type CardHandle = { swipe: (action: SwipeAction) => void };

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 500;
const EXIT_DISTANCE = 640;
const STALE_AFTER_MS = (SIGNED_URL_TTL_SECONDS - 300) * 1000;

const cardClass = "absolute inset-0 overflow-hidden rounded-[2rem] bg-surface";

function CardPoster({ card }: { card: DeckCard }) {
  if (!card.posterUrl) {
    return <div className="absolute inset-0 bg-linear-to-b from-raised to-coral-deep/50" />;
  }
  return (
    <img
      src={card.posterUrl}
      alt=""
      draggable={false}
      className="absolute inset-0 size-full object-cover"
    />
  );
}

function BackCard({ card }: { card: DeckCard }) {
  return (
    <div className={`${cardClass} origin-top -translate-y-2.5 scale-[0.93] opacity-70`} aria-hidden>
      <CardPoster card={card} />
    </div>
  );
}

function TopCard({
  card,
  ref,
  onDecide,
}: {
  card: DeckCard;
  ref: Ref<CardHandle>;
  onDecide: (action: SwipeAction) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-12, 12]);
  const likeOpacity = useTransform(x, [30, SWIPE_DISTANCE], [0, 1]);
  const passOpacity = useTransform(x, [-SWIPE_DISTANCE, -30], [1, 0]);
  const reducedMotion = useReducedMotion();
  const leaving = useRef(false);

  function leave(action: SwipeAction) {
    if (leaving.current) return;
    leaving.current = true;

    if (reducedMotion) {
      onDecide(action);
      return;
    }

    const target = action === "like" ? EXIT_DISTANCE : -EXIT_DISTANCE;
    animate(x, target, { duration: 0.28 }).then(() => onDecide(action));
  }

  useImperativeHandle(ref, () => ({ swipe: leave }));

  return (
    <motion.article
      aria-label={`${card.displayName}${card.age ? `, ${card.age} anos` : ""}`}
      style={{ x, rotate }}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.7}
      onDragEnd={(_, { offset, velocity }) => {
        if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) leave("like");
        else if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) leave("pass");
      }}
      initial={{ scale: 0.95, y: -12 }}
      animate={{ scale: 1, y: 0 }}
      className={`${cardClass} cursor-grab active:cursor-grabbing`}
    >
      <CardPoster card={card} />
      {card.videoUrl && (
        <LoopVideo
          src={card.videoUrl}
          poster={card.posterUrl ?? undefined}
          className="pointer-events-none absolute inset-0 size-full object-cover"
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/90 via-black/40 to-transparent" />

      {card.videoUrl && (
        <span className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur">
          <Video className="size-4" aria-label="Tem vídeo" />
        </span>
      )}

      <motion.span
        style={{ opacity: likeOpacity }}
        className="absolute top-8 left-6 -rotate-12 rounded-xl border-2 border-coral px-3 py-1 font-display text-2xl font-semibold text-coral"
        aria-hidden
      >
        Curtir
      </motion.span>
      <motion.span
        style={{ opacity: passOpacity }}
        className="absolute top-8 right-6 rotate-12 rounded-xl border-2 border-cream px-3 py-1 font-display text-2xl font-semibold text-cream"
        aria-hidden
      >
        Passar
      </motion.span>

      <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-5 pt-5 pb-12">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-display text-3xl font-semibold text-white">
            <span className="truncate">{card.displayName}</span>
            {card.age && <span className="shrink-0 font-normal">{card.age}</span>}
            <BadgeCheck className="size-6 shrink-0 text-coral" aria-label="Perfil aprovado" />
          </h2>
          {card.isPro && (
            <span className="mt-1.5 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur">
              Pro
            </span>
          )}
          {card.bio && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-white/80">{card.bio}</p>
          )}
        </div>
        {/* Sem isso, arrastar a partir do botão termina em clique no link. */}
        <Link
          href={`/perfil/${card.id}`}
          aria-label={`Ver perfil de ${card.displayName}`}
          onPointerDown={(event) => event.stopPropagation()}
          draggable={false}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
        >
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      </div>
    </motion.article>
  );
}

function MatchOverlay({ card, onClose }: { card: DeckCard; onClose: () => void }) {
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/95 px-8 text-center backdrop-blur"
    >
      <div className="relative size-36 overflow-hidden rounded-full ring-4 ring-coral">
        <CardPoster card={card} />
      </div>
      <h2 id="match-title" className="mt-6 font-display text-4xl font-semibold">
        Deu match!
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Você e {card.displayName} se curtiram.
      </p>
      <div className="mt-8 w-full max-w-xs space-y-2">
        <Link
          href={`/perfil/${card.id}`}
          className="flex h-13 items-center justify-center rounded-full bg-coral font-semibold text-ink"
        >
          Ver perfil
        </Link>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="h-13 w-full rounded-full bg-surface font-semibold text-cream"
        >
          Continuar
        </button>
      </div>
    </motion.div>
  );
}

export function Deck({ initialCards }: { initialCards: DeckCard[] }) {
  const [cards, setCards] = useState(initialCards);
  const [match, setMatch] = useState<DeckCard | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refilling, setRefilling] = useState(false);
  const topCard = useRef<CardHandle>(null);
  const pending = useRef(new Set<Promise<void>>());
  const loadedAt = useRef(0);

  useLayoutEffect(
    () => () => {
      setMatch(null);
      setNotice(null);
    },
    [],
  );

  async function saveSwipe(card: DeckCard, action: SwipeAction) {
    try {
      const result = await recordSwipe(card.id, action);
      if (!result.ok) throw new Error("Swipe recusado");
      if (result.match) setMatch(card);
    } catch {
      setNotice("Não deu para salvar sua última escolha.");
    }
  }

  async function refill() {
    setRefilling(true);
    setNotice(null);
    // Sem esperar, quem acabou de passar poderia voltar antes de quem ainda não foi visto.
    await Promise.allSettled(pending.current);

    let fresh: DeckCard[] | null = null;
    try {
      fresh = await loadMoreCards();
    } catch {
      // Tratado abaixo, junto com a resposta vazia do servidor.
    }

    setRefilling(false);
    if (fresh) {
      loadedAt.current = Date.now();
      setCards(fresh);
    } else {
      setNotice("Não deu para buscar mais pessoas.");
    }
  }

  const refreshIfStale = useEffectEvent(() => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - loadedAt.current > STALE_AFTER_MS) void refill();
  });

  // Os links das fotos vencem, e um PWA reaberto dias depois mostraria imagens quebradas.
  useEffect(() => {
    if (!loadedAt.current) loadedAt.current = Date.now();
    refreshIfStale();

    const onVisibilityChange = () => refreshIfStale();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  function decide(card: DeckCard, action: SwipeAction) {
    setNotice(null);

    const request: Promise<void> = saveSwipe(card, action).finally(() => {
      pending.current.delete(request);
    });
    pending.current.add(request);

    const rest = cards.filter(({ id }) => id !== card.id);
    setCards(rest);
    if (rest.length === 0) void refill();
  }

  const [current, next] = cards;

  return (
    <section aria-label="Pessoas" className="relative flex min-h-0 flex-1 flex-col px-4 pt-3">
      <div className="relative min-h-0 flex-1">
        {current ? (
          <>
            {next && <BackCard key={next.id} card={next} />}
            <TopCard
              key={current.id}
              ref={topCard}
              card={current}
              onDecide={(action) => decide(current, action)}
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-[2rem] bg-surface p-8 text-center">
            {refilling ? (
              <LoaderCircle className="size-6 animate-spin text-muted" aria-label="Carregando" />
            ) : (
              <>
                <h2 className="font-display text-2xl font-semibold">Por agora, é só</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Novas pessoas entram a cada aprovação. Volte daqui a pouco.
                </p>
                <button
                  type="button"
                  onClick={refill}
                  className="mt-5 flex h-10 items-center justify-center gap-2 rounded-full bg-raised px-4 text-sm font-semibold text-cream transition"
                >
                  <RefreshCw className="size-4" aria-hidden />
                  Atualizar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="absolute inset-x-8 top-6 z-20 rounded-full bg-black/70 px-4 py-2 text-center text-xs text-cream backdrop-blur"
        >
          {notice}
        </p>
      )}

      {/* Fora do card: assim o foco não se perde quando o card troca. */}
      <div className={`relative z-10 -mt-7 mb-3 flex justify-center gap-4 ${current ? "" : "invisible"}`}>
        <button
          type="button"
          aria-label="Passar"
          onClick={() => topCard.current?.swipe("pass")}
          className="flex h-14 w-20 items-center justify-center rounded-full bg-raised text-cream shadow-lg shadow-black/40 transition active:scale-95"
        >
          <X className="size-6" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Curtir"
          onClick={() => topCard.current?.swipe("like")}
          className="flex h-14 w-20 items-center justify-center rounded-full bg-coral text-ink shadow-lg shadow-black/40 transition active:scale-95"
        >
          <Heart className="size-6 fill-current" aria-hidden />
        </button>
      </div>

      <AnimatePresence>
        {match && <MatchOverlay card={match} onClose={() => setMatch(null)} />}
      </AnimatePresence>
    </section>
  );
}
