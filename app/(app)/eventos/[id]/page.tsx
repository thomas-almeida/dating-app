import { CalendarDays, MapPin, Pencil, User, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { BackButton } from "@/components/back-button";
import { requireMember } from "@/lib/dal";
import { formatEventDate } from "@/lib/event-date";
import { signPaths } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import type { EventPerson, EventRow } from "@/lib/types";
import { AttendButton, DeleteEventButton } from "./event-actions";

export const metadata: Metadata = { title: "Evento" };

const idSchema = z.uuid();

async function Content({ params }: { params: PageProps<"/eventos/[id]">["params"] }) {
  const [{ id }, { user }] = await Promise.all([params, requireMember()]);
  if (!idSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data, error }, { data: attendees }] = await Promise.all([
    supabase.rpc("get_event", { p_id: id }),
    supabase.rpc("event_people", { p_event: id }),
  ]);

  if (error) console.error("get_event", error);

  const event = (data as EventRow[] | null)?.[0];
  if (!event) notFound();

  const people = (attendees ?? []) as EventPerson[];
  const urls = await signPaths([...event.photo_paths, ...people.map((person) => person.photo_path)]);
  const photos = event.photo_paths.flatMap((path) => (urls[path] ? [urls[path]] : []));

  const isOwner = event.owner_id === user.id;
  const started = new Date(event.starts_at) <= new Date();

  return (
    <>
      <div className="flex-1 space-y-4 px-4 pb-32">
        {photos.length > 0 && (
          <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4">
            {photos.map((url) => (
              <img
                key={url}
                src={url}
                alt={`Foto de ${event.name}`}
                className="aspect-video w-full shrink-0 snap-center rounded-[2rem] object-cover"
              />
            ))}
          </div>
        )}

        <section>
          <h1 className="font-display text-3xl font-semibold">{event.name}</h1>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            <li className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0" aria-hidden />
              {formatEventDate(event.starts_at)}
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {event.location}
            </li>
            <li className="flex items-center gap-2">
              <UserRound className="size-4 shrink-0" aria-hidden />
              Organizado por {event.organizer}
            </li>
          </ul>
        </section>

        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/eventos/${event.id}/editar`}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-cream"
            >
              <Pencil className="size-4" aria-hidden />
              Editar
            </Link>
            <DeleteEventButton eventId={event.id} />
          </div>
        )}

        <section className="rounded-3xl bg-surface p-5">
          <h2 className="font-display text-xl font-semibold">Sobre</h2>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted">
            {event.description}
          </p>
        </section>

        <section aria-labelledby="attendees-title" className="rounded-3xl bg-surface p-5">
          <h2 id="attendees-title" className="font-display text-xl font-semibold">
            {event.going_count} {event.going_count === 1 ? "confirmado" : "confirmados"}
          </h2>
          {people.length > 0 && (
            <ul className="mt-3 space-y-2">
              {people.map((person) => {
                const photoUrl = person.photo_path ? urls[person.photo_path] : undefined;

                return (
                  <li key={person.id}>
                    <Link href={`/perfil/${person.id}`} className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised text-muted">
                        {photoUrl ? (
                          <img src={photoUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <User className="size-4" aria-hidden />
                        )}
                      </span>
                      <span className="truncate text-sm font-semibold">{person.nickname}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-md bg-linear-to-t from-ink via-ink/90 to-transparent px-5 pt-8">
        <div className="mb-4">
          {started ? (
            <p className="flex h-13 items-center justify-center rounded-full bg-surface text-sm font-semibold text-muted">
              Este evento já começou
            </p>
          ) : (
            <AttendButton eventId={event.id} going={event.going} />
          )}
        </div>
      </div>
    </>
  );
}

function EventSkeleton() {
  return (
    <div className="flex-1 animate-pulse space-y-3 px-4" aria-hidden>
      <div className="aspect-video rounded-[2rem] bg-surface" />
      <div className="h-9 w-2/3 rounded-xl bg-surface" />
      <div className="h-28 rounded-3xl bg-surface" />
    </div>
  );
}

export default function EventPage({ params }: PageProps<"/eventos/[id]">) {
  return (
    <main className="pt-safe flex flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center px-5">
        <BackButton fallback="/eventos" />
      </header>

      <Suspense fallback={<EventSkeleton />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}
