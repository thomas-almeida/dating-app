import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackButton } from "@/components/back-button";
import { requireAdmin } from "@/lib/dal";
import { signPaths } from "@/lib/media";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Ad } from "@/lib/types";
import { AdForm } from "./ad-form";
import { AdList, type AdEntry } from "./ad-list";

export const metadata: Metadata = { title: "Anúncios" };

type EventRow = { ad_id: string; kind: "impression" | "click" };

async function Content() {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: ads, error }, { data: events, error: eventsError }] = await Promise.all([
    admin.from("ads").select("*").order("created_at", { ascending: false }),
    admin.from("ad_events").select("ad_id, kind"),
  ]);

  if (error) console.error("ads", error);
  if (eventsError) console.error("ad_events", eventsError);

  if (error) {
    return (
      <p role="alert" className="rounded-3xl bg-surface p-6 text-center text-sm text-muted">
        Não deu para carregar os anúncios. Atualize a página.
      </p>
    );
  }

  const rows = (ads ?? []) as Ad[];
  const urls = await signPaths(rows.map((ad) => ad.image_path));

  // Agregação na memória: com poucos anúncios isso é mais simples que uma view no banco.
  const reach = new Map<string, number>();
  const clicks = new Map<string, number>();
  for (const event of (events ?? []) as EventRow[]) {
    const target = event.kind === "click" ? clicks : reach;
    target.set(event.ad_id, (target.get(event.ad_id) ?? 0) + 1);
  }

  const entries: AdEntry[] = rows.map((ad) => ({
    id: ad.id,
    title: ad.title,
    description: ad.description,
    targetUrl: ad.target_url,
    imageUrl: urls[ad.image_path] ?? null,
    active: ad.active,
    reach: reach.get(ad.id) ?? 0,
    clicks: clicks.get(ad.id) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <AdForm />
      <AdList ads={entries} />
    </div>
  );
}

function AdsSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden>
      <div className="h-72 rounded-3xl bg-surface" />
      <div className="h-28 rounded-3xl bg-surface" />
    </div>
  );
}

export default function AdsPage() {
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="flex items-center gap-3 py-5">
        <BackButton fallback="/admin" />
        <h1 className="flex-1 font-display text-3xl font-semibold">Anúncios</h1>
      </header>

      <p className="mb-4 text-sm leading-relaxed text-muted">
        Os anúncios entram entre os cards do deck. Quem assina o Pro não recebe nenhum.{" "}
        <Link href="/admin" className="underline underline-offset-2">
          Voltar ao painel
        </Link>
      </p>

      <Suspense fallback={<AdsSkeleton />}>
        <Content />
      </Suspense>
    </main>
  );
}
