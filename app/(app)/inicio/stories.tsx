"use client";

import { LoaderCircle, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useLayoutEffect, useState, type ChangeEvent } from "react";
import { ProSheet, type ProReason } from "@/components/pro-sheet";
import { MediaError, uploadPhoto, uploadVideo, VIDEO_ACCEPT } from "@/lib/media-upload";
import type { StoryPerson } from "@/lib/types";
import { publishStory } from "./actions";
import { StoryViewer } from "./story-viewer";

type StoryItem = StoryPerson & { hasStory: boolean };

const OWN_LABEL = "Seu story";

function StoryRing({
  label,
  photoUrl,
  active,
  children,
}: {
  label: string;
  photoUrl: string | null;
  active: boolean;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={`relative block rounded-full p-0.5 ${
        active ? "bg-linear-to-tr from-coral-deep to-coral" : "bg-line"
      }`}
    >
      <span className="flex size-14 items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-raised font-display text-lg font-semibold text-cream">
        {photoUrl ? <img src={photoUrl} alt="" className="size-full object-cover" /> : label.charAt(0)}
      </span>
      {children}
    </span>
  );
}

function StoryLabel({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block truncate text-center text-xs text-cream">{children}</span>;
}

// Quem é free vê o cadeado. Quem é Pro abre o story, ou o perfil de quem não postou nada.
export function Stories({
  people,
  own,
  isPro,
  canPost,
}: {
  people: StoryItem[];
  own: StoryPerson;
  isPro: boolean;
  canPost: boolean;
}) {
  const [paywall, setPaywall] = useState<ProReason | null>(null);
  const [viewing, setViewing] = useState<StoryPerson | null>(null);
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const closePaywall = useCallback(() => setPaywall(null), []);
  const closeViewer = useCallback(() => setViewing(null), []);

  useLayoutEffect(
    () => () => {
      setPaywall(null);
      setViewing(null);
      setNotice(null);
    },
    [],
  );

  async function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Sem limpar, escolher o mesmo arquivo de novo não dispara change.
    event.target.value = "";
    if (!file) return;

    setPosting(true);
    setNotice(null);
    try {
      const isVideo = file.type.startsWith("video/");
      const { path } = isVideo ? await uploadVideo(own.id, file) : await uploadPhoto(own.id, file);
      const result = await publishStory(path, isVideo ? "video" : "image");
      if (!result.ok) setNotice(result.message);
    } catch (error) {
      setNotice(
        error instanceof MediaError ? error.message : "Não deu para postar. Tente outra foto ou vídeo.",
      );
    } finally {
      setPosting(false);
    }
  }

  const hasOwnStory = own.stories.length > 0;

  return (
    <>
      <ul aria-label="Stories" className="scrollbar-none flex shrink-0 gap-3 overflow-x-auto px-5 py-1">
        <li className="w-15 shrink-0">
          <div className="relative">
            {hasOwnStory ? (
              <button
                type="button"
                aria-label="Ver seu story"
                onClick={() => setViewing(own)}
                className="block w-full"
              >
                <StoryRing label={own.label} photoUrl={own.photoUrl} active />
              </button>
            ) : (
              <StoryRing label={own.label} photoUrl={own.photoUrl} active={false} />
            )}

            {canPost && (
              <label
                className={`absolute cursor-pointer ${hasOwnStory ? "right-0 bottom-0 size-6" : "inset-0"}`}
              >
                <input
                  type="file"
                  accept={`image/*,${VIDEO_ACCEPT}`}
                  disabled={posting}
                  onChange={handlePick}
                  aria-label="Postar story"
                  className="sr-only"
                />
                <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full border-2 border-ink bg-coral text-ink">
                  {posting ? (
                    <LoaderCircle className="size-2.5 animate-spin" aria-label="Postando" />
                  ) : (
                    <Plus className="size-3" aria-hidden />
                  )}
                </span>
              </label>
            )}
          </div>
          <StoryLabel>{OWN_LABEL}</StoryLabel>
        </li>

        {people.map((person) => {
          const ring = (
            <StoryRing label={person.label} photoUrl={person.photoUrl} active={person.hasStory}>
              {!isPro && (
                <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full border-2 border-ink bg-cream text-ink">
                  <Lock className="size-2.5" aria-hidden />
                </span>
              )}
            </StoryRing>
          );

          return (
            <li key={person.id} className="w-15 shrink-0">
              {!isPro ? (
                <button
                  type="button"
                  aria-label={`Story de ${person.label}, recurso Pro`}
                  onClick={() => setPaywall("stories")}
                  className="block w-full"
                >
                  {ring}
                </button>
              ) : person.stories.length > 0 ? (
                <button
                  type="button"
                  aria-label={`Ver story de ${person.label}`}
                  onClick={() => setViewing(person)}
                  className="block w-full"
                >
                  {ring}
                </button>
              ) : (
                <Link href={`/perfil/${person.id}`} className="block">
                  {ring}
                </Link>
              )}
              <StoryLabel>{person.label}</StoryLabel>
            </li>
          );
        })}
      </ul>

      {notice && (
        <p role="status" className="shrink-0 px-5 pt-1 text-xs text-cream">
          {notice}
        </p>
      )}

      <ProSheet reason={paywall} onClose={closePaywall} />

      {viewing && (
        <StoryViewer
          person={viewing}
          isOwn={viewing.id === own.id}
          isPro={isPro}
          onClose={closeViewer}
        />
      )}
    </>
  );
}
