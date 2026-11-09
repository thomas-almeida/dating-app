import { Crown, ShieldCheck, User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { GradientBackground } from "@/components/gradient-background";
import { InstallPrompt } from "@/components/install-prompt";
import { Wordmark } from "@/components/wordmark";
import { DECK_SIZE, STORY_COUNT } from "@/lib/config";
import { requireMember } from "@/lib/dal";
import { signPaths, toDeckCards } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import type { PublicProfile, StoryMedia, StoryProfile, StoryRow } from "@/lib/types";
import { Deck } from "./deck";
import { Stories } from "./stories";

export const metadata: Metadata = { title: "Início" };

async function Content() {
  const { user, profile, isAdmin } = await requireMember();
  const supabase = await createClient();

  const [discovered, stories, feed] = await Promise.all([
    supabase.rpc("discover_profiles", { p_limit: DECK_SIZE }),
    supabase.rpc("story_profiles", { p_limit: STORY_COUNT }),
    supabase.rpc("story_feed"),
  ]);

  if (discovered.error) console.error("discover_profiles", discovered.error);
  if (stories.error) console.error("story_profiles", stories.error);
  if (feed.error) console.error("story_feed", feed.error);

  const storyProfiles = (stories.data ?? []) as StoryProfile[];
  const feedRows = (feed.data ?? []) as StoryRow[];
  const avatarPath = profile.photo_paths[0];

  const [cards, urls] = await Promise.all([
    toDeckCards((discovered.data ?? []) as PublicProfile[], profile),
    signPaths([
      avatarPath,
      ...storyProfiles.map((story) => story.photo_path),
      ...feedRows.map((row) => row.media_path),
    ]),
  ]);

  const avatarUrl = avatarPath ? urls[avatarPath] : undefined;

  const storiesOf = (userId: string): StoryMedia[] =>
    feedRows.flatMap((row) => {
      const url = urls[row.media_path];
      return row.user_id === userId && url
        ? [{ id: row.id, type: row.media_type, url, liked: row.liked }]
        : [];
    });

  const ownStories = storiesOf(user.id);

  return (
    <>
      <header className="pt-safe shrink-0">
        <div className="flex h-16 items-center justify-between px-5">
          <Link
            href="/perfil"
            aria-label="Seu perfil"
            className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-surface text-muted"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <User className="size-4" aria-hidden />
            )}
          </Link>
          <Wordmark />
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin"
                aria-label="Abrir painel administrativo"
                className="flex size-10 items-center justify-center rounded-full bg-surface text-cream transition hover:bg-raised"
              >
                <ShieldCheck className="size-4" aria-hidden />
              </Link>
            )}
            <Link
              href="/pro"
              aria-label="Conhecer o Pro"
              className={`flex size-10 items-center justify-center rounded-full transition ${
                profile.is_pro ? "bg-coral text-ink" : "bg-surface text-cream hover:bg-raised"
              }`}
            >
              <Crown className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <Stories
        isPro={profile.is_pro}
        canPost={profile.is_pro || ownStories.length === 0}
        own={{
          id: user.id,
          label: profile.nickname ?? profile.name,
          photoUrl: avatarUrl ?? null,
          stories: ownStories,
        }}
        people={storyProfiles.map((story) => ({
          id: story.id,
          label: story.nickname ?? "",
          photoUrl: story.photo_path ? (urls[story.photo_path] ?? null) : null,
          hasStory: story.has_story === true,
          stories: storiesOf(story.id),
        }))}
      />

      <Deck
        initialCards={cards}
        viewer={{
          name: profile.nickname ?? profile.name,
          photoUrl: avatarUrl ?? null,
          isPro: profile.is_pro,
        }}
      />

      <div className="shrink-0">
        <BottomNav active="inicio" />
      </div>

      {/* Boolean, e não !== null: antes da migration 0003 a coluna vem undefined. */}
      <InstallPrompt installed={Boolean(profile.app_installed_at)} />
    </>
  );
}

function HomeSkeleton() {
  return (
    <div className="pt-safe flex min-h-0 flex-1 animate-pulse flex-col" aria-hidden>
      <div className="flex h-16 items-center justify-between px-5">
        <div className="size-10 rounded-full bg-surface" />
        <div className="h-6 w-24 rounded-full bg-surface" />
        <div className="size-10 rounded-full bg-surface" />
      </div>
      <div className="flex gap-3 px-5 py-1">
        <div className="size-15 rounded-full bg-surface" />
        <div className="size-15 rounded-full bg-surface" />
        <div className="size-15 rounded-full bg-surface" />
        <div className="size-15 rounded-full bg-surface" />
      </div>
      <div className="mx-4 mt-5 mb-3 min-h-0 flex-1 rounded-[2rem] bg-surface" />
      <div className="mx-5 mb-3 h-14 rounded-full bg-surface" />
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="isolate flex h-dvh flex-col overflow-hidden">
      <GradientBackground />

      <Suspense fallback={<HomeSkeleton />}>
        <Content />
      </Suspense>
    </main>
  );
}
