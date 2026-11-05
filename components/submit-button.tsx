"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function SubmitButton({
  children,
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`flex h-13 w-full items-center justify-center gap-2 rounded-full bg-coral px-6 font-semibold text-ink transition active:scale-[0.98] disabled:opacity-60 ${className}`}
    >
      {pending ? <Loader2 className="size-5 animate-spin" aria-label="Enviando" /> : children}
    </button>
  );
}
