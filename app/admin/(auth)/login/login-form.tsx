"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage } from "@/components/admin/field";
import { SubmitButton } from "@/components/admin/submit-button";
import { signIn } from "./actions";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(signIn, { ok: false, message: notice });
  const [forgot, setForgot] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <Field label="E-mail" name="email">
        <input id="email" name="email" type="email" autoComplete="username" required className="field-input" />
      </Field>
      <Field label="Senha" name="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field-input"
        />
      </Field>
      <SubmitButton pendingText="Entrando…" className="btn btn-primary w-full">
        Entrar
      </SubmitButton>
      <button type="button" onClick={() => setForgot(true)} className="text-sm text-olive underline">
        Esqueci minha senha
      </button>
      {forgot && (
        <p role="status" className="text-sm text-cocoa-soft">
          Peça um novo link a um administrador. Ele gera o link em Usuários e envia pelo WhatsApp.
        </p>
      )}
    </form>
  );
}
