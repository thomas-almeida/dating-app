"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Field, FormMessage, inputClass } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { maskPhone } from "@/lib/phone";
import type { FormState } from "@/lib/types";
import { joinWaitlist } from "./actions";

const initialState: FormState = { status: "idle" };

export function WaitlistForm() {
  const [state, formAction] = useActionState(joinWaitlist, initialState);
  // O React reseta o form quando a action termina, mesmo com erro: o estado guarda o que foi digitado.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);

  if (state.status === "ok") {
    return (
      <div className="rounded-3xl border border-line bg-surface p-6 text-center" role="status">
        <CheckCircle2 className="mx-auto size-9 text-coral" aria-hidden />
        <p className="mt-3 font-display text-xl font-semibold">Recebemos o seu cadastro</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-3xl border border-line bg-surface/80 p-5">
      <Field label="Nome">
        <input
          name="name"
          required
          maxLength={80}
          autoComplete="name"
          placeholder="Como você se chama"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="E-mail">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Telefone">
        <input
          name="phone"
          type="tel"
          required
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(11) 91234-5678"
          value={phone}
          onChange={(event) => setPhone(maskPhone(event.target.value))}
          className={inputClass}
        />
      </Field>

      {/* Honeypot: fora da tela e fora da ordem de tabulação. */}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] size-px opacity-0"
      />

      <label className="flex items-start gap-3 text-sm leading-snug text-muted">
        <input
          name="consent"
          type="checkbox"
          required
          defaultChecked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 size-5 accent-coral"
        />
        Tenho 18 anos ou mais e aceito que meus dados sejam usados para analisar o meu cadastro.
      </label>

      <FormMessage message={state.status === "error" ? state.message : undefined} />
      <SubmitButton>Entrar na lista de espera</SubmitButton>
    </form>
  );
}
