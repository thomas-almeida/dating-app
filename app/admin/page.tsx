import { LogOut, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/entrar/actions";
import { Wordmark } from "@/components/wordmark";
import { requireAdmin } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WaitlistEntry, WaitlistStatus } from "@/lib/types";
import { enterApp } from "./actions";
import { AdminList } from "./admin-list";

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

const LIST_LIMIT = 200;

const FILTERS: { status: WaitlistStatus; label: string; empty: string }[] = [
  { status: "pending", label: "Pendentes", empty: "Ninguém esperando aprovação." },
  { status: "approved", label: "Aprovados", empty: "Nenhum convite em aberto." },
  { status: "activated", label: "Ativos", empty: "Ninguém criou conta ainda." },
  { status: "rejected", label: "Recusados", empty: "Ninguém foi recusado." },
];

async function loadEntries(status: WaitlistStatus) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("waitlist")
    .select("id, name, email, phone, status, invite_expires_at, approved_at, user_id, created_at")
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(LIST_LIMIT);

  if (error) {
    console.error("loadEntries", error);
    return null;
  }

  const entries = data as WaitlistEntry[];
  const userIds = entries.flatMap((entry) => (entry.user_id ? [entry.user_id] : []));
  if (userIds.length === 0) return entries.map((entry) => ({ ...entry, isPro: false }));

  const { data: profiles } = await admin.from("profiles").select("id, is_pro").in("id", userIds);
  const proIds = new Set(profiles?.filter((profile) => profile.is_pro).map(({ id }) => id));

  return entries.map((entry) => ({
    ...entry,
    isPro: entry.user_id ? proIds.has(entry.user_id) : false,
  }));
}

async function loadCounts() {
  const admin = createAdminClient();
  const results = await Promise.all(
    FILTERS.map(({ status }) =>
      admin.from("waitlist").select("id", { count: "exact", head: true }).eq("status", status),
    ),
  );
  return results.map((result) => result.count ?? 0);
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await requireAdmin();

  const params = await searchParams;
  const current = FILTERS.find(({ status }) => status === params.status) ?? FILTERS[0];
  const [entries, counts] = await Promise.all([loadEntries(current.status), loadCounts()]);

  return (
    <>
      <nav aria-label="Filtrar por status" className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5">
        {FILTERS.map(({ status, label }, index) => (
          <Link
            key={status}
            href={`/admin?status=${status}`}
            aria-current={status === current.status ? "page" : undefined}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
              status === current.status ? "bg-cream text-ink" : "bg-surface text-muted"
            }`}
          >
            {label}
            <span className="tabular-nums opacity-70">{counts[index]}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        {entries === null ? (
          <p role="alert" className="rounded-3xl bg-surface p-6 text-center text-sm text-muted">
            Não deu para carregar a lista. Atualize a página.
          </p>
        ) : (
          <AdminList entries={entries} emptyMessage={current.empty} />
        )}
      </div>
    </>
  );
}

function AdminSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden>
      <div className="h-10 w-full rounded-full bg-surface" />
      <div className="h-32 rounded-3xl bg-surface" />
      <div className="h-32 rounded-3xl bg-surface" />
    </div>
  );
}

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="pt-safe pb-safe mx-auto w-full max-w-2xl flex-1 px-5">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-baseline gap-3">
          <Wordmark />
          <span className="text-sm text-muted">Painel</span>
        </div>
        <div className="flex items-center gap-2">
          <form action={enterApp}>
            <button
              type="submit"
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-cream px-4 text-sm font-semibold text-ink transition"
            >
              <Smartphone className="size-4" aria-hidden />
              Ir para o app
            </button>
          </form>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sair"
              className="flex size-10 items-center justify-center rounded-full bg-surface text-muted transition hover:text-cream"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </header>

      <div className="pb-10">
        <Suspense fallback={<AdminSkeleton />}>
          <Content searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
