"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useLayoutEffect, useState } from "react";
import { FormMessage } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "@/lib/types";
import { cancelPro, startCheckout } from "./actions";

const initialState: FormState = { status: "idle" };

const REFRESH_INTERVAL_MS = 4000;
const MAX_REFRESHES = 15;

export function CheckoutForm({ available }: { available: boolean }) {
  const [state, formAction] = useActionState(startCheckout, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage message={state.status === "error" ? state.message : undefined} />
      <SubmitButton disabled={!available}>Assinar o Pro</SubmitButton>
      {!available && (
        <p className="text-center text-xs text-muted">As assinaturas abrem em breve.</p>
      )}
    </form>
  );
}

export function CancelForm() {
  const [state, formAction] = useActionState(cancelPro, initialState);
  const [confirming, setConfirming] = useState(false);

  useLayoutEffect(() => () => setConfirming(false), []);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-10 w-full rounded-full text-sm font-semibold text-muted transition hover:text-cream"
      >
        Cancelar assinatura
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-3xl bg-surface p-5">
      <p className="text-sm leading-relaxed text-muted">
        O cancelamento vale na hora: o Pro acaba agora, sem dias restantes, e não dá para desfazer.
      </p>
      <FormMessage message={state.status === "error" ? state.message : undefined} />
      <SubmitButton>Cancelar agora</SubmitButton>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="h-10 w-full rounded-full text-sm font-semibold text-muted transition hover:text-cream"
      >
        Manter o Pro
      </button>
    </form>
  );
}

// O Pro é ligado pelo webhook, que pode chegar depois da volta do checkout.
export function PaymentPending() {
  const router = useRouter();

  useEffect(() => {
    let refreshes = 0;
    const timer = setInterval(() => {
      refreshes += 1;
      if (refreshes >= MAX_REFRESHES) clearInterval(timer);
      router.refresh();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <p role="status" className="rounded-3xl bg-surface p-5 text-center text-sm text-muted">
      Estamos confirmando o seu pagamento. Esta tela atualiza sozinha, e pode levar alguns minutos.
    </p>
  );
}
