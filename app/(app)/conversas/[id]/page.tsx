import { User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { BackButton } from "@/components/back-button";
import { requireMember } from "@/lib/dal";
import { signPaths } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage, PublicProfile } from "@/lib/types";
import { Chat } from "./chat";

export const metadata: Metadata = { title: "Conversa" };

const idSchema = z.uuid();

async function Content({ params }: { params: PageProps<"/conversas/[id]">["params"] }) {
  const [{ id }] = await Promise.all([params, requireMember()]);
  if (!idSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: rows, error }, { data: messages }] = await Promise.all([
    supabase.rpc("get_public_profile", { p_id: id }),
    supabase.rpc("chat_messages", { p_with: id }),
  ]);

  if (error) console.error("get_public_profile", error);

  // Sem match não há conversa: quem chega pelo link vê o mesmo que num endereço inexistente.
  const person = (rows as (PublicProfile & { is_match: boolean })[] | null)?.[0];
  if (!person?.is_match) notFound();

  const displayName = person.nickname ?? person.name;
  const photoPath = person.photo_paths[0];
  const urls = await signPaths([photoPath]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4">
        <BackButton fallback="/matches" />
        <Link
          href={`/perfil/${person.id}`}
          aria-label={`Ver perfil de ${displayName}`}
          className="flex min-w-0 items-center gap-2.5"
        >
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-muted">
            {urls[photoPath] ? (
              <img src={urls[photoPath]} alt="" className="size-full object-cover" />
            ) : (
              <User className="size-4" aria-hidden />
            )}
          </span>
          <span className="truncate font-display text-xl font-semibold">{displayName}</span>
        </Link>
      </header>

      <Chat
        personId={person.id}
        personName={displayName}
        initialMessages={[...((messages ?? []) as ChatMessage[])].reverse()}
      />
    </>
  );
}

function ChatSkeleton() {
  return (
    <div className="flex-1 animate-pulse space-y-3 p-4" aria-hidden>
      <div className="h-10 w-1/2 rounded-3xl bg-surface" />
      <div className="ml-auto h-10 w-2/3 rounded-3xl bg-surface" />
    </div>
  );
}

export default function ConversationPage({ params }: PageProps<"/conversas/[id]">) {
  return (
    <main className="pt-safe flex h-dvh flex-col">
      <Suspense fallback={<ChatSkeleton />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}
