import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { BackButton } from "@/components/back-button";
import { requireMember } from "@/lib/dal";
import { toDateInput } from "@/lib/event-date";
import { signPaths } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";
import { EventForm } from "../../event-form";

export const metadata: Metadata = { title: "Editar evento" };

const idSchema = z.uuid();

async function Content({ params }: { params: PageProps<"/eventos/[id]/editar">["params"] }) {
  const [{ id }, { user }] = await Promise.all([params, requireMember()]);
  if (!idSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_event", { p_id: id });

  const event = (data as EventRow[] | null)?.[0];
  if (!event || event.owner_id !== user.id) notFound();

  const urls = await signPaths(event.photo_paths);

  return (
    // Rotas ficam montadas em segundo plano: sem a key, o form guardaria as fotos antigas.
    <EventForm
      key={event.photo_paths.join()}
      userId={user.id}
      eventId={event.id}
      initial={{
        name: event.name,
        description: event.description,
        location: event.location,
        organizer: event.organizer,
        startsAt: toDateInput(event.starts_at),
      }}
      initialPhotos={event.photo_paths.flatMap((path) =>
        urls[path] ? [{ path, url: urls[path] }] : [],
      )}
    />
  );
}

export default function EditEventPage({ params }: PageProps<"/eventos/[id]/editar">) {
  return (
    <main className="pt-safe pb-safe flex-1 px-5">
      <header className="flex items-center gap-3 py-5">
        <BackButton fallback="/eventos" />
        <h1 className="font-display text-2xl font-semibold">Editar evento</h1>
      </header>

      <Suspense fallback={null}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}
