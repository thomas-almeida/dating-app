"use client";

import { Check, LoaderCircle, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteEvent, toggleAttendance } from "../actions";

export function AttendButton({ eventId, going }: { eventId: string; going: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={going}
      onClick={() => startTransition(() => toggleAttendance(eventId))}
      className={`flex h-13 w-full items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:opacity-60 ${
        going ? "bg-surface text-cream" : "bg-coral text-ink"
      }`}
    >
      {pending ? (
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
      ) : (
        !going && <Check className="size-5" aria-hidden />
      )}
      {going ? "Cancelar presença" : "Confirmar presença"}
    </button>
  );
}

// Dois toques, para ninguém apagar o evento sem querer.
export function DeleteEventButton({ eventId }: { eventId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex h-11 items-center justify-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-cream"
      >
        <Trash2 className="size-4" aria-hidden />
        Excluir
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteEvent(eventId))}
        className="h-11 rounded-full bg-coral px-4 text-sm font-semibold text-ink disabled:opacity-60"
      >
        Excluir de vez
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="h-11 rounded-full bg-surface px-4 text-sm font-semibold text-cream"
      >
        Manter
      </button>
    </div>
  );
}
