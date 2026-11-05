import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = {
  title: "Sem conexão",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="pt-safe pb-safe mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-5 text-center">
      <Wordmark />
      <WifiOff className="mt-10 size-8 text-muted" aria-hidden />
      <h1 className="mt-4 font-display text-3xl font-semibold">Você está sem conexão</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Quando a internet voltar, é só tentar de novo.
      </p>
      <Link
        href="/inicio"
        prefetch={false}
        className="mt-8 flex h-13 w-full items-center justify-center rounded-full bg-coral font-semibold text-ink"
      >
        Tentar de novo
      </Link>
    </main>
  );
}
