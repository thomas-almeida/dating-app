import { BadgeCheck, ChevronRight, Eye, Heart, Lock, MapPin, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { BackButton } from "@/components/back-button";
import { BottomNav } from "@/components/bottom-nav";
import { HobbyTags } from "@/components/hobby-tags";
import { LoopVideo } from "@/components/loop-video";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { Wordmark } from "@/components/wordmark";
import { placeLabel, sameRegion, tagHobbies } from "@/lib/affinity";
import { APP_NAME } from "@/lib/config";
import { requireMember } from "@/lib/dal";
import { signPaths } from "@/lib/media";
import { whatsappUrl } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import type { ProfileStats, PublicProfile } from "@/lib/types";

export const metadata: Metadata = { title: "Perfil" };

const idSchema = z.uuid();

type ProfileDetails = PublicProfile & { is_match: boolean };

function StatsCard({ stats }: { stats: ProfileStats | null }) {
  if (!stats) {
    return (
      <Link href="/pro" className="flex items-center gap-4 rounded-3xl bg-surface p-5">
        <Lock className="size-5 shrink-0 text-coral" aria-hidden />
        <span className="flex-1 text-sm leading-relaxed text-muted">
          Veja quantas visitas e curtidas seu perfil teve com o Pro.
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </Link>
    );
  }

  return (
    <section aria-label="Métricas do perfil" className="grid grid-cols-2 gap-3">
      <div className="rounded-3xl bg-surface p-5">
        <Eye className="size-5 text-coral" aria-hidden />
        <p className="mt-3 font-display text-3xl font-semibold tabular-nums">{stats.profile_views}</p>
        <p className="text-sm text-muted">Visitas ao perfil</p>
      </div>
      <Link href="/curtidas" className="rounded-3xl bg-surface p-5">
        <Heart className="size-5 text-coral" aria-hidden />
        <p className="mt-3 font-display text-3xl font-semibold tabular-nums">{stats.likes_received}</p>
        <p className="text-sm text-muted">Curtidas</p>
      </Link>
    </section>
  );
}

async function Content({ params }: { params: PageProps<"/perfil/[id]">["params"] }) {
  const [{ id }, viewer] = await Promise.all([params, requireMember()]);
  if (!idSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const isOwn = id === viewer.user.id;

  // A RLS devolve o contato só para quem é Pro: o número nunca chega aos outros.
  // No próprio perfil a terceira consulta traz as métricas; no dos outros, conta a visita.
  const [{ data: rows, error }, { data: contact }, extra] = await Promise.all([
    supabase.rpc("get_public_profile", { p_id: id }),
    supabase.from("profile_contacts").select("whatsapp").eq("user_id", id).maybeSingle(),
    isOwn ? supabase.rpc("my_insights") : supabase.rpc("record_profile_view", { p_id: id }),
  ]);

  if (error) console.error("get_public_profile", error);
  if (extra.error) console.error("profile extra", extra.error);

  const person = (rows as ProfileDetails[] | null)?.[0];
  if (!person) notFound();

  const urls = await signPaths([person.video_path, ...person.photo_paths]);

  const stats = isOwn ? ((extra.data as ProfileStats[] | null)?.[0] ?? null) : null;
  const displayName = person.nickname ?? person.name;
  const videoUrl = person.video_path ? urls[person.video_path] : undefined;
  const photos = person.photo_paths.flatMap((path) => (urls[path] ? [urls[path]] : []));
  const gallery = videoUrl ? photos : photos.slice(1);

  const greeting = `Oi, ${displayName}! Vi seu perfil no ${APP_NAME}.`;
  const whatsappHref = contact ? whatsappUrl(contact.whatsapp, greeting) : null;
  const canAskToMessage = !isOwn && (whatsappHref !== null || !viewer.profile.is_pro);

  // No próprio perfil não há o que destacar.
  const hobbies = tagHobbies(isOwn ? [] : viewer.profile.hobbies, person.hobbies);
  const nearby = !isOwn && sameRegion(viewer.profile, person);
  const place = placeLabel(person);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between px-5">
        <BackButton />
        <Wordmark />
        {isOwn ? (
          <Link
            href="/perfil/editar"
            aria-label="Editar perfil"
            className="flex size-10 items-center justify-center rounded-full bg-surface text-cream transition hover:bg-raised"
          >
            <Settings className="size-4" aria-hidden />
          </Link>
        ) : (
          <span className="size-10" aria-hidden />
        )}
      </header>

      <div className={`flex-1 space-y-3 px-4 ${canAskToMessage ? "pb-28" : "pb-4"}`}>
        <section className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-linear-to-b from-raised to-coral-deep/50">
          {videoUrl ? (
            <LoopVideo
              src={videoUrl}
              poster={photos[0]}
              className="absolute inset-0 size-full object-cover"
            />
          ) : photos[0] ? (
            <img src={photos[0]} alt="" className="absolute inset-0 size-full object-cover" />
          ) : null}

          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-black/85 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 p-5">
            <h1 className="flex items-center gap-2 font-display text-3xl font-semibold text-white">
              <span className="truncate">{displayName}</span>
              {person.age && <span className="shrink-0 font-normal">{person.age}</span>}
              <BadgeCheck className="size-6 shrink-0 text-coral" aria-label="Perfil aprovado" />
            </h1>
            {place && (
              <p className="mt-1 flex items-center gap-1 text-sm text-white/80">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                {place}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 empty:hidden">
              {person.is_match && (
                <span className="flex items-center gap-1.5 rounded-full bg-coral px-3 py-1 text-xs font-semibold text-ink">
                  <Heart className="size-3 fill-current" aria-hidden />
                  Vocês deram match
                </span>
              )}
              {person.is_pro && (
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  Pro
                </span>
              )}
              <HobbyTags hobbies={hobbies} sameRegion={nearby} />
            </div>
          </div>
        </section>

        {isOwn && <StatsCard stats={stats} />}

        {person.bio && (
          <section className="rounded-3xl bg-surface p-5 text-center">
            <h2 className="font-display text-xl font-semibold">Sobre</h2>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted">
              {person.bio}
            </p>
          </section>
        )}

        {gallery.map((url) => (
          <img
            key={url}
            src={url}
            alt={`Foto de ${displayName}`}
            className="w-full rounded-[2rem] object-cover"
          />
        ))}
      </div>

      {canAskToMessage && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-md bg-linear-to-t from-ink via-ink/90 to-transparent px-5 pt-8">
          <div className="mb-4">
            <WhatsAppButton href={whatsappHref} />
          </div>
        </div>
      )}

      {isOwn && (
        <div className="sticky bottom-0 bg-linear-to-t from-ink via-ink/90 to-transparent pt-4">
          <BottomNav active="perfil" />
        </div>
      )}
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex-1 animate-pulse space-y-3 px-4 pt-16" aria-hidden>
      <div className="aspect-[4/5] rounded-[2rem] bg-surface" />
      <div className="h-28 rounded-3xl bg-surface" />
    </div>
  );
}

export default function ProfilePage({ params }: PageProps<"/perfil/[id]">) {
  return (
    <main className="pt-safe flex flex-1 flex-col">
      <Suspense fallback={<ProfileSkeleton />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}
