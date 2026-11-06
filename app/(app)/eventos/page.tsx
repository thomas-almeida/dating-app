import { CalendarDays, Check, MapPin, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { requireMember } from "@/lib/dal";
import { formatEventDate } from "@/lib/event-date";
import { signPaths } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";

export const metadata: Metadata = { title: "Eventos" };

async function EventList() {
  await requireMember();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_events");

  if (error) {
    console.error("list_events", error);
    return (
      <p role="alert" className="rounded-3xl bg-surface p-6 text-center text-sm text-muted">
        Não deu para carregar os eventos. Atualize a página.
      </p>
    );
  }

  const events = data as EventRow[];

  if (events.length === 0) {
    return (
      <p className="rounded-3xl bg-surface p-6 text-center text-sm text-muted">
        Ainda não há eventos. Que tal criar o primeiro?
      </p>
    );
  }

  const urls = await signPaths(events.map((event) => event.photo_paths[0]));

  return (
    <ul className="space-y-3">
      {events.map((event) => {
        const coverUrl = urls[event.photo_paths[0]];

        return (
          <li key={event.id}>
            <Link href={`/eventos/${event.id}`} className="block overflow-hidden rounded-3xl bg-surface">
              <span className="relative block aspect-video bg-linear-to-br from-raised to-coral-deep/50">
                {coverUrl && (
                  <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
                )}
                {event.going && (
                  <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-coral px-2.5 py-0.5 text-xs font-semibold text-ink">
                    <Check className="size-3" aria-hidden />
                    Você vai
                  </span>
                )}
              </span>
              <span className="block p-4">
                <span className="block font-display text-xl font-semibold">{event.name}</span>
                <span className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
                  <CalendarDays className="size-4 shrink-0" aria-hidden />
                  {formatEventDate(event.starts_at)}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                  <MapPin className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{event.location}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                  <Users className="size-4 shrink-0" aria-hidden />
                  {event.going_count} {event.going_count === 1 ? "confirmado" : "confirmados"}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function EventsSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden>
      <div className="h-64 rounded-3xl bg-surface" />
      <div className="h-64 rounded-3xl bg-surface" />
    </div>
  );
}

export default function EventsPage() {
  return (
    <main className="pt-safe flex flex-1 flex-col">
      <header className="flex items-center justify-between px-5 py-5">
        <h1 className="font-display text-3xl font-semibold">Eventos</h1>
        <Link
          href="/eventos/novo"
          className="flex h-10 items-center gap-1.5 rounded-full bg-coral px-4 text-sm font-semibold text-ink"
        >
          <Plus className="size-4" aria-hidden />
          Criar
        </Link>
      </header>

      <div className="flex-1 px-4 pb-4">
        <Suspense fallback={<EventsSkeleton />}>
          <EventList />
        </Suspense>
      </div>

      <div className="sticky bottom-0 bg-linear-to-t from-ink via-ink/90 to-transparent pt-4">
        <BottomNav active="eventos" />
      </div>
    </main>
  );
}
