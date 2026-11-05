import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export default function NotFound() {
  return (
    <main className="pt-safe pb-safe mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-5 text-center">
      <Wordmark />
      <h1 className="mt-10 font-display text-3xl font-semibold">Não encontramos essa página</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        O link pode estar errado, ou a pessoa pode ter saído do app.
      </p>
      <Link
        href="/inicio"
        className="mt-8 flex h-13 w-full items-center justify-center rounded-full bg-coral font-semibold text-ink"
      >
        Voltar para o início
      </Link>
    </main>
  );
}
