"use client";

import { useActionState } from "react";
import { Field, FormMessage } from "@/components/admin/field";
import { SubmitButton } from "@/components/admin/submit-button";
import { setPassword } from "./actions";

export function PasswordForm({ email }: { email: string }) {
  const [state, action] = useActionState(setPassword, { ok: false });

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      {/* Lets password managers save the new password for the right account. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <Field label="Nova senha" name="password" errors={state.fieldErrors?.password} hint="Mínimo de 8 caracteres">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
          className="field-input"
        />
      </Field>
      <Field label="Repita a senha" name="confirm" errors={state.fieldErrors?.confirm}>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.confirm)}
          className="field-input"
        />
      </Field>
      <SubmitButton className="btn btn-primary w-full">Salvar senha e entrar</SubmitButton>
    </form>
  );
}
