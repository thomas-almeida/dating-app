import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/wordmark";
import { findActiveInvite } from "@/lib/invite";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = {
  title: "Criar senha",
  robots: { index: false, follow: false },
};

async function Content({ params }: { params: PageProps<"/convite/[token]">["params"] }) {
  const { token } = await params;
  const invite = isSupabaseConfigured() ? await findActiveInvite(token) : null;

  if (!invite) {
    return (
      <>
        <h1 className="font-display text-3xl font-semibold">Esse convite não vale mais</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          O link venceu ou já foi usado. Se você já criou a sua senha, é só entrar. Se não, peça um
          novo link para a nossa equipe.
        </p>
        <Link
          href="/entrar"
          className="mt-6 flex h-13 items-center justify-center rounded-full bg-coral font-semibold text-ink"
        >
          Ir para o login
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">
        Você foi aprovado, {invite.name.split(" ")[0]}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Crie uma senha para entrar com <span className="text-cream">{invite.email}</span>.
      </p>
      <div className="mt-6">
        <InviteForm token={token} email={invite.email} />
      </div>
    </>
  );
}

function InviteSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-9 w-3/4 rounded-xl bg-surface" />
      <div className="h-4 w-full rounded-lg bg-surface" />
      <div className="h-13 rounded-2xl bg-surface" />
      <div className="h-13 rounded-2xl bg-surface" />
    </div>
  );
}

export default function InvitePage({ params }: PageProps<"/convite/[token]">) {
  return (
    <main className="pt-safe pb-safe mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5">
      <div className="py-10">
        <Wordmark />
        <div className="mt-8">
          <Suspense fallback={<InviteSkeleton />}>
            <Content params={params} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
