import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BackButton } from "@/components/back-button";
import { BottomNav } from "@/components/bottom-nav";
import { PersonGrid } from "@/components/person-grid";
import { requireMember } from "@/lib/dal";
import { signPaths } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import type { LikerProfile } from "@/lib/types";

export const metadata: Metadata = { title: "Quem te curtiu" };

async function LikerList() {
  const { profile } = await requireMember();
  if (!profile.is_pro) redirect("/pro");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_likers");

  if (error) {
    console.error("my_likers", error);
    return (
      <p role="alert" className="rounded-3xl bg-surface p-6 text-center text-sm text-muted">
        Não deu para carregar suas curtidas. Atualize a página.
      </p>
    );
  }

  const likers = data as LikerProfile[];

  if (likers.length === 0) {
    return (
      <p className="rounded-3xl bg-surface p-6 text-center text-sm text-muted">
        Quando alguém curtir você, aparece aqui.
      </p>
    );
  }

  const urls = await signPaths(likers.map((liker) => liker.photo_paths[0]));

  return (
    <PersonGrid
      people={likers.map((liker) => ({
        id: liker.id,
        label: liker.nickname ?? liker.name,
        age: liker.age,
        photoUrl: urls[liker.photo_paths[0]],
      }))}
    />
  );
}

function LikersSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-2 gap-3" aria-hidden>
      <div className="aspect-[3/4] rounded-3xl bg-surface" />
      <div className="aspect-[3/4] rounded-3xl bg-surface" />
    </div>
  );
}

export default function LikersPage() {
  return (
    <main className="pt-safe flex flex-1 flex-col">
      <header className="flex items-center gap-3 px-5 py-5">
        <BackButton fallback="/perfil" />
        <h1 className="font-display text-3xl font-semibold">Quem te curtiu</h1>
      </header>

      <div className="flex-1 px-4 pb-4">
        <Suspense fallback={<LikersSkeleton />}>
          <LikerList />
        </Suspense>
      </div>

      <div className="sticky bottom-0 bg-linear-to-t from-ink via-ink/90 to-transparent pt-4">
        <BottomNav active="perfil" />
      </div>
    </main>
  );
}
