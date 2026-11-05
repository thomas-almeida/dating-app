"use client";

import { useActionState } from "react";
import { Field, FormMessage, inputClass } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "@/lib/types";
import { acceptInvite } from "./actions";

const initialState: FormState = { status: "idle" };

export function InviteForm({ token, email }: { token: string; email: string }) {
  const [state, formAction] = useActionState(acceptInvite, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {/* Deixa o gerenciador de senhas guardar a credencial com o e-mail certo. */}
      <input type="hidden" name="username" value={email} autoComplete="username" />

      <Field label="Senha" hint="Pelo menos 8 caracteres.">
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>
      <Field label="Repita a senha">
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      <FormMessage message={state.status === "error" ? state.message : undefined} />
      <SubmitButton>Criar minha conta</SubmitButton>
    </form>
  );
}
