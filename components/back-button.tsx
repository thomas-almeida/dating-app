"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

// Quem abre um link direto não tem para onde voltar.
export function BackButton({ fallback = "/inicio" }: { fallback?: string }) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push(fallback);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Voltar"
      className="flex size-10 items-center justify-center rounded-full bg-surface text-cream transition hover:bg-raised"
    >
      <ChevronLeft className="size-5" aria-hidden />
    </button>
  );
}
