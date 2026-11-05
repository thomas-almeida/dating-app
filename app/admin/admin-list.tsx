"use client";

import { Check, Copy, Crown, Link2, MessageCircle, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { inputClass } from "@/components/field";
import { APP_NAME } from "@/lib/config";
import { displayPhone } from "@/lib/phone";
import type { WaitlistEntry } from "@/lib/types";
import { approveEntry, rejectEntry, setPro, type AdminResult } from "./actions";

type AdminEntry = WaitlistEntry & { isPro: boolean };

type Invite = { name: string; phone: string; url: string };

// Fuso fixo: servidor e navegador precisam escrever a mesma data.
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const actionClass =
  "flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition disabled:opacity-50";

function InviteDialog({ invite, onClose }: { invite: Invite; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const firstName = invite.name.split(" ")[0];
  const message = `Oi, ${firstName}! Sua entrada no ${APP_NAME} foi aprovada. Crie a sua senha por este link: ${invite.url}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
    } catch {
      linkRef.current?.select();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="invite-title"
      className="m-auto w-[calc(100%-2.5rem)] max-w-sm rounded-3xl bg-surface p-6 text-cream backdrop:bg-black/70"
    >
      <h2 id="invite-title" className="font-display text-2xl font-semibold">
        Convite de {firstName}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Esse link só aparece agora. Mande para a pessoa antes de fechar.
      </p>

      <input
        ref={linkRef}
        readOnly
        value={invite.url}
        aria-label="Link do convite"
        onFocus={(event) => event.currentTarget.select()}
        className={`${inputClass} mt-4 text-sm`}
      />

      <div className="mt-4 space-y-2">
        <a
          href={`https://wa.me/${invite.phone}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className={`${actionClass} h-12 w-full bg-coral text-ink`}
        >
          <MessageCircle className="size-4" aria-hidden />
          Enviar no WhatsApp
        </a>
        <button
          type="button"
          onClick={copyLink}
          className={`${actionClass} h-12 w-full bg-raised text-cream`}
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? "Link copiado" : "Copiar link"}
        </button>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className={`${actionClass} w-full text-muted`}
        >
          Fechar
        </button>
      </div>
    </dialog>
  );
}

// O convite fica aqui, e não na linha: aprovar tira a linha do filtro de pendentes.
// Pelo mesmo motivo a lista cuida do próprio estado vazio: desmontar levaria o convite junto.
export function AdminList({
  entries,
  emptyMessage,
}: {
  entries: AdminEntry[];
  emptyMessage: string;
}) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useLayoutEffect(
    () => () => {
      setInvite(null);
      setError(null);
    },
    [],
  );

  function run(entry: AdminEntry, action: () => Promise<AdminResult>) {
    setBusyId(entry.id);
    setError(null);

    startTransition(async () => {
      let result: AdminResult;
      try {
        result = await action();
      } catch {
        result = { ok: false, message: "Sem conexão com o servidor. Tente de novo." };
      }

      setBusyId(null);
      if (!result.ok) {
        setError(result.message);
      } else if (result.inviteUrl) {
        setInvite({ name: entry.name, phone: entry.phone, url: result.inviteUrl });
      }
    });
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 rounded-2xl bg-coral/15 px-4 py-3 text-sm text-coral">
          {error}
        </p>
      )}

      {entries.length === 0 && (
        <p className="rounded-3xl bg-surface p-6 text-center text-sm text-muted">{emptyMessage}</p>
      )}

      <ul className="space-y-3">
        {entries.map((entry) => {
          const busy = busyId === entry.id;
          const userId = entry.user_id;

          return (
            <li key={entry.id} className="rounded-3xl bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{entry.name}</span>
                    {entry.isPro && <Crown className="size-4 shrink-0 text-coral" aria-label="Pro" />}
                  </p>
                  <p className="mt-1 truncate text-sm text-muted">{entry.email}</p>
                  <p className="text-sm text-muted">{displayPhone(entry.phone)}</p>
                </div>
                <time dateTime={entry.created_at} className="shrink-0 text-xs text-muted">
                  {dateFormat.format(new Date(entry.created_at))}
                </time>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {entry.status === "pending" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(entry, () => approveEntry(entry.id))}
                    className={`${actionClass} bg-coral text-ink`}
                  >
                    <Check className="size-4" aria-hidden />
                    Aprovar
                  </button>
                )}
                {entry.status === "rejected" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(entry, () => approveEntry(entry.id))}
                    className={`${actionClass} bg-raised text-cream`}
                  >
                    <Check className="size-4" aria-hidden />
                    Aprovar mesmo assim
                  </button>
                )}
                {entry.status === "approved" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(entry, () => approveEntry(entry.id))}
                    className={`${actionClass} bg-raised text-cream`}
                  >
                    <Link2 className="size-4" aria-hidden />
                    Gerar novo link
                  </button>
                )}
                {(entry.status === "pending" || entry.status === "approved") && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(entry, () => rejectEntry(entry.id))}
                    className={`${actionClass} text-muted`}
                  >
                    <X className="size-4" aria-hidden />
                    Recusar
                  </button>
                )}
                {entry.status === "activated" && userId && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(entry, () => setPro(userId, !entry.isPro))}
                    className={`${actionClass} bg-raised text-cream`}
                  >
                    <Crown className="size-4" aria-hidden />
                    {entry.isPro ? "Tirar Pro" : "Liberar Pro"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {invite && <InviteDialog invite={invite} onClose={() => setInvite(null)} />}
    </>
  );
}
