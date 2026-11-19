"use client";

import { ExternalLink, LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import type { AdminResult } from "@/app/admin/actions";
import { deleteAd, setAdActive } from "./actions";

export type AdEntry = {
  id: string;
  title: string;
  description: string;
  targetUrl: string;
  imageUrl: string | null;
  active: boolean;
  reach: number;
  clicks: number;
};

function ctr(reach: number, clicks: number) {
  if (reach === 0) return "—";
  return `${((clicks / reach) * 100).toFixed(1)}%`;
}

export function AdList({ ads }: { ads: AdEntry[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<AdminResult>) {
    setBusy(id);
    setNotice(null);
    const result = await action();
    setBusy(null);
    setConfirming(null);
    if (!result.ok) setNotice(result.message);
  }

  if (ads.length === 0) {
    return (
      <p className="rounded-3xl bg-surface p-6 text-center text-sm text-muted">
        Nenhum anúncio cadastrado.
      </p>
    );
  }

  return (
    <>
      {notice && (
        <p role="alert" className="rounded-2xl bg-surface p-4 text-sm text-cream">
          {notice}
        </p>
      )}

      <ul className="space-y-3">
        {ads.map((ad) => (
          <li key={ad.id} className="rounded-3xl bg-surface p-4">
            <div className="flex gap-3">
              <span className="block w-16 shrink-0 overflow-hidden rounded-xl bg-raised">
                {ad.imageUrl ? (
                  <img src={ad.imageUrl} alt="" className="aspect-[3/5] w-full object-cover" />
                ) : (
                  <span className="block aspect-[3/5] w-full" aria-hidden />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="truncate">{ad.title}</span>
                  {!ad.active && (
                    <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-xs text-muted">
                      Pausado
                    </span>
                  )}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">{ad.description}</p>
                <a
                  href={ad.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-1 flex items-center gap-1 text-xs text-muted underline underline-offset-2"
                >
                  <span className="truncate">{ad.targetUrl}</span>
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                </a>
                {/* Alcance conta uma exibição por pessoa por dia, e não cada vez que o card aparece. */}
                <p className="mt-1.5 text-xs tabular-nums text-muted">
                  {ad.reach} alcance · {ad.clicks} cliques · {ctr(ad.reach, ad.clicks)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={busy === ad.id}
                onClick={() => run(ad.id, () => setAdActive(ad.id, !ad.active))}
                className="h-10 flex-1 rounded-full bg-raised text-sm font-semibold text-cream transition disabled:opacity-60"
              >
                {busy === ad.id ? (
                  <LoaderCircle className="mx-auto size-4 animate-spin" aria-label="Salvando" />
                ) : ad.active ? (
                  "Pausar"
                ) : (
                  "Ativar"
                )}
              </button>

              {confirming === ad.id ? (
                <>
                  <button
                    type="button"
                    disabled={busy === ad.id}
                    onClick={() => run(ad.id, () => deleteAd(ad.id))}
                    className="h-10 rounded-full bg-coral px-4 text-sm font-semibold text-ink transition disabled:opacity-60"
                  >
                    Excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="h-10 rounded-full px-3 text-sm font-semibold text-muted"
                  >
                    Não
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  aria-label={`Excluir ${ad.title}`}
                  onClick={() => setConfirming(ad.id)}
                  className="flex size-10 items-center justify-center rounded-full bg-raised text-muted transition"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </div>

            {confirming === ad.id && (
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Excluir leva as métricas junto. Para manter o histórico, use Pausar.
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
