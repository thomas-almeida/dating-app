import type { Metadata } from "next";
import { Suspense } from "react";
import { BackButton } from "@/components/back-button";
import { requireMember } from "@/lib/dal";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "Criar evento" };

async function Content() {
  const { user, profile } = await requireMember();

  return (
    <EventForm
      userId={user.id}
      initial={{
        name: "",
        description: "",
        location: "",
        organizer: profile.nickname ?? profile.name,
        startsAt: "",
      }}
      initialPhotos={[]}
    />
  );
}

export default function NewEventPage() {
  return (
    <main className="pt-safe pb-safe flex-1 px-5">
      <header className="flex items-center gap-3 py-5">
        <BackButton fallback="/eventos" />
        <h1 className="font-display text-2xl font-semibold">Criar evento</h1>
      </header>

      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </main>
  );
}
