"use client";

import { Heart, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type SyntheticEvent } from "react";
import type { StoryAudienceMember, StoryPerson } from "@/lib/types";
import { loadStoryAudience, markStoryViewed, toggleStoryLike } from "./actions";

const FALLBACK_VIDEO_SECONDS = 5;

function Avatar({ label, photoUrl }: { label: string; photoUrl: string | null }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised text-sm font-semibold text-cream">
      {photoUrl ? <img src={photoUrl} alt="" className="size-full object-cover" /> : label.charAt(0)}
    </span>
  );
}

function AudienceSheet({
  audience,
  onClose,
}: {
  audience: StoryAudienceMember[];
  onClose: () => void;
}) {
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-20 max-h-[60%] overflow-y-auto rounded-t-3xl bg-surface">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Quem viu</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar lista"
            className="flex size-9 items-center justify-center rounded-full bg-raised text-muted"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {audience.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Ninguém viu ainda.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {audience.map(({ id, label, photoUrl, liked }) => (
              <li key={id}>
                <Link href={`/perfil/${id}`} className="flex items-center gap-3">
                  <Avatar label={label} photoUrl={photoUrl} />
                  <span className="flex-1 truncate font-semibold">{label}</span>
                  {liked && <Heart className="size-4 fill-coral text-coral" aria-label="Curtiu" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function StoryViewer({
  person,
  isOwn,
  isPro,
  onClose,
}: {
  person: StoryPerson;
  isOwn: boolean;
  isPro: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [videoSeconds, setVideoSeconds] = useState<number | null>(null);
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [audience, setAudience] = useState<StoryAudienceMember[] | null>(null);
  const [audienceOpen, setAudienceOpen] = useState(false);

  const story = person.stories[index];
  const liked = likes[story.id] ?? story.liked;
  const likeCount = audience?.filter((member) => member.liked).length ?? 0;
  const barReady = story.type === "image" || videoSeconds !== null;

  useEffect(() => {
    if (!isOwn) {
      markStoryViewed(story.id).catch(() => {});
      return;
    }

    let active = true;
    loadStoryAudience(story.id)
      .then((members) => {
        if (active) setAudience(members);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [story.id, isOwn]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function move(step: number) {
    const target = index + step;
    if (target >= person.stories.length) {
      onClose();
    } else if (target >= 0) {
      setIndex(target);
      setVideoSeconds(null);
      setAudience(null);
    }
  }

  function handleVideoReady(event: SyntheticEvent<HTMLVideoElement>) {
    const { duration } = event.currentTarget;
    setVideoSeconds(Number.isFinite(duration) ? duration : FALLBACK_VIDEO_SECONDS);
  }

  async function toggleLike() {
    const next = !liked;
    const { id } = story;
    setLikes((current) => ({ ...current, [id]: next }));

    const saved = await toggleStoryLike(id).catch(() => null);
    setLikes((current) => ({ ...current, [id]: saved ?? !next }));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Story de ${person.label}`}
      className="fixed inset-0 z-50 bg-black"
    >
      <div className="pt-safe relative mx-auto flex h-full w-full max-w-md flex-col overflow-hidden">
        {story.type === "video" ? (
          <video
            key={story.id}
            src={story.url}
            autoPlay
            muted
            loop
            playsInline
            onLoadedMetadata={handleVideoReady}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <img
            key={story.id}
            src={story.url}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        )}

        <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-black/60 to-transparent" />

        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="Story anterior"
          className="absolute inset-y-0 left-0 w-1/3"
        />
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="Próximo story"
          className="absolute inset-y-0 right-0 w-2/3"
        />

        <div className="relative z-10 px-3 pt-3">
          <div className="flex gap-1">
            {person.stories.map(({ id }, position) => (
              <span key={id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
                {position < index && <span className="block size-full bg-white" />}
                {/* Com movimento reduzido a barra some: sem ela, a troca fica no toque. */}
                {position === index && barReady && (
                  <span
                    onAnimationEnd={() => move(1)}
                    style={videoSeconds ? { animationDuration: `${videoSeconds}s` } : undefined}
                    className={`block size-full origin-left animate-story-progress bg-white motion-reduce:hidden ${
                      audienceOpen ? "[animation-play-state:paused]" : ""
                    }`}
                  />
                )}
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-2 rounded-full bg-black/40 py-1 pr-4 pl-1 text-sm font-semibold text-white backdrop-blur">
              <Avatar label={person.label} photoUrl={person.photoUrl} />
              {person.label}
            </span>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              aria-label="Fechar story"
              className="flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="pb-safe relative z-10 mt-auto">
          <div className="flex flex-col items-center gap-3 p-5">
            {isOwn ? (
              <>
                <button
                  type="button"
                  disabled={audience === null}
                  onClick={() => setAudienceOpen(true)}
                  className="rounded-full bg-black/50 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition disabled:opacity-60"
                >
                  {audience === null
                    ? "Quem viu"
                    : `Visto por ${audience.length} · ${likeCount} ${likeCount === 1 ? "curtida" : "curtidas"}`}
                </button>
                {!isPro && (
                  <Link href="/pro" className="text-center text-xs text-white/85 underline underline-offset-4">
                    Você pode postar 1 story por dia. Com o Pro, não há limite.
                  </Link>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={toggleLike}
                aria-label={liked ? "Descurtir story" : "Curtir story"}
                aria-pressed={liked}
                className="flex size-14 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition active:scale-95"
              >
                <Heart className={`size-6 ${liked ? "fill-coral text-coral" : ""}`} aria-hidden />
              </button>
            )}
          </div>
        </div>

        {audienceOpen && audience && (
          <AudienceSheet audience={audience} onClose={() => setAudienceOpen(false)} />
        )}
      </div>
    </div>
  );
}
