"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, inputClass } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { resetInstallDismissal } from "@/lib/install";
import type { FormState } from "@/lib/types";
import { signIn } from "./actions";

const initialState: FormState = { status: "idle" };

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialState);
  // O React reseta o form quando a action termina, mesmo com erro: o estado guarda o e-mail.
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} onSubmit={resetInstallDismissal} className="space-y-4">
      <Field label="E-mail">
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="voce@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Senha">
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </Field>

      <FormMessage message={state.status === "error" ? state.message : undefined} />
      <SubmitButton>Entrar</SubmitButton>
    </form>
  );
}
