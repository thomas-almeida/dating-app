import { User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { PushPrompt } from "@/components/push-prompt";
import { requireMember } from "@/lib/dal";
import { signPaths } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import type { Conversation } from "@/lib/types";

export const metadata: Metadata = { title: "Matches" };

function preview({ last_body, last_from_me }: Conversation) {
  if (!last_body) return "Vocês deram match. Diga oi!";
  return last_from_me ? `Você: ${last_body}` : last_body;
}

async function ConversationList() {
  await requireMember();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_conversations");

  if (error) {
    console.error("my_conversations", error);
    return (
      <p role="alert" className="rounded-3xl bg-surface p-6 text-center text-sm text-muted">
        Não deu para carregar seus matches. Atualize a página.
      </p>
    );
  }

  const conversations = data as Conversation[];

  if (conversations.length === 0) {
    return (
      <p className="rounded-3xl bg-surface p-6 text-center text-sm text-muted">
        Quando alguém que você curtiu curtir você de volta, aparece aqui.
      </p>
    );
  }

  const urls = await signPaths(conversations.map((person) => person.photo_paths[0]));

  return (
    <ul className="space-y-2">
      {conversations.map((person) => {
        const label = person.nickname ?? person.name;
        const photoUrl = urls[person.photo_paths[0]];

        return (
          <li key={person.id}>
            <Link
              href={`/conversas/${person.id}`}
              className="flex items-center gap-3 rounded-3xl bg-surface p-3"
            >
              <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised text-muted">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="size-full object-cover" />
                ) : (
                  <User className="size-5" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {label}
                  {person.age && <span className="font-normal text-muted"> {person.age}</span>}
                </span>
                <span
                  className={`block truncate text-sm ${
                    person.unread > 0 ? "font-semibold text-cream" : "text-muted"
                  }`}
                >
                  {preview(person)}
                </span>
              </span>
              {person.unread > 0 && (
                <span
                  aria-label={`${person.unread} não lidas`}
                  className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-coral px-1.5 text-xs font-semibold text-ink"
                >
                  {person.unread}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function MatchesSkeleton() {
  return (
    <div className="animate-pulse space-y-2" aria-hidden>
      <div className="h-20 rounded-3xl bg-surface" />
      <div className="h-20 rounded-3xl bg-surface" />
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
        {/* Fora da lista: quem ainda não tem match é quem mais quer saber do primeiro. */}
        <PushPrompt />
        <Suspense fallback={<MatchesSkeleton />}>
          <ConversationList />
        </Suspense>
      </div>

      <div className="sticky bottom-0 bg-linear-to-t from-ink via-ink/90 to-transparent pt-4">
        <BottomNav active="matches" />
      </div>
    </main>
  );
}
