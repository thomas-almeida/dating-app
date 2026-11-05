import type { Metadata } from "next";
import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { PersonGrid } from "@/components/person-grid";
import { requireMember } from "@/lib/dal";
import { signPaths } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import type { MatchProfile } from "@/lib/types";

export const metadata: Metadata = { title: "Matches" };

async function MatchList() {
  await requireMember();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_matches");

  if (error) {
    console.error("my_matches", error);
    return (
      <p role="alert" className="rounded-3xl bg-surface p-6 text-center text-sm text-muted">
        Não deu para carregar seus matches. Atualize a página.
      </p>
    );
  }

  const matches = data as MatchProfile[];

  if (matches.length === 0) {
    return (
      <p className="rounded-3xl bg-surface p-6 text-center text-sm text-muted">
        Quando alguém que você curtiu curtir você de volta, aparece aqui.
      </p>
    );
  }

  const urls = await signPaths(matches.map((match) => match.photo_paths[0]));

  return (
    <PersonGrid
      people={matches.map((match) => ({
        id: match.id,
        label: match.nickname ?? match.name,
        age: match.age,
        photoUrl: urls[match.photo_paths[0]],
      }))}
    />
  );
}

function MatchesSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-2 gap-3" aria-hidden>
      <div className="aspect-[3/4] rounded-3xl bg-surface" />
      <div className="aspect-[3/4] rounded-3xl bg-surface" />
    </div>
  );
}

export default function MatchesPage() {
  return (
    <main className="pt-safe flex flex-1 flex-col">
      <header className="px-5 py-5">
        <h1 className="font-display text-3xl font-semibold">Matches</h1>
      </header>

      <div className="flex-1 px-4 pb-4">
        <Suspense fallback={<MatchesSkeleton />}>
          <MatchList />
        </Suspense>
      </div>

      <div className="sticky bottom-0 bg-linear-to-t from-ink via-ink/90 to-transparent pt-4">
        <BottomNav active="matches" />
      </div>
    </main>
  );
}
