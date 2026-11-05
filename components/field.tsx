import type { ReactNode } from "react";

const controlClass =
  "w-full rounded-2xl border border-line bg-surface px-4 text-cream placeholder:text-muted/70 transition focus:border-coral focus:outline-none";

export const inputClass = `h-13 ${controlClass}`;

export const textareaClass = `min-h-32 resize-none py-3 leading-relaxed ${controlClass}`;

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-cream">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function FormMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral">
      {message}
    </p>
  );
}
