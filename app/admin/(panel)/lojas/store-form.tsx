"use client";

import { Field, FormMessage } from "@/components/admin/field";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { HoursEditor } from "@/components/admin/hours-editor";
import { SubmitButton } from "@/components/admin/submit-button";
import type { AdminStore } from "@/lib/admin/catalog";
import { StatusBadge } from "@/components/admin/status-badge";
import type { AccountState } from "@/lib/payments/accounts";
import { accountEnvNames } from "@/lib/payments/alias";
import { formatWhatsapp } from "@/lib/phone";
import { parseStoredHours } from "@/lib/validators/store";
import { saveStore } from "./actions";

// Each sector has its own number (spec 08).
const WHATSAPP_FIELDS = [
  { name: "whatsapp_ready", label: "WhatsApp · Pronta entrega", hint: "Recebe pedidos só da vitrine" },
  { name: "whatsapp_made_to_order", label: "WhatsApp · Encomenda", hint: "Recebe pedidos com bolo, cento ou kit" },
  { name: "whatsapp_support", label: "WhatsApp · SAC", hint: "Único número mostrado no site" },
] as const;

// Stage 11: what the saved alias means on this server.
export const PAYMENT_STATES: Record<AccountState, { label: string; tone: "green" | "gray" | "red"; text: string }> = {
  ativo: { label: "Ativo", tone: "green", text: "O site oferece pagamento por Pix ou cartão nesta loja." },
  sem_chaves: {
    label: "Conta sem chaves no servidor",
    tone: "red",
    text: "O site continua só com WhatsApp até as chaves desta conta serem cadastradas na Vercel.",
  },
  desligado: { label: "Desligado", tone: "gray", text: "Sem conta: os pedidos desta loja seguem só pelo WhatsApp." },
};

export function StoreForm({ store }: { store?: AdminStore }) {
  const [state, action, round] = useAdminForm(saveStore.bind(null, store?.id ?? null), { ok: false });
  const echoed = state.values;
  const text = (key: string, saved: string) => (echoed ? String(echoed[key] ?? "") : saved);
  const errors = state.fieldErrors ?? {};

  return (
    <form key={round} action={action} className="space-y-8">
      <FormMessage state={state} />
      <fieldset className="space-y-4">
        <legend className="mb-2 text-xl text-olive">Dados</legend>
        <Field label="Nome" name="name" errors={errors.name}>
          <input id="name" name="name" required defaultValue={text("name", store?.name ?? "")} className="field-input" />
        </Field>
        <Field label="Endereço" name="address" errors={errors.address}>
          <input id="address" name="address" required defaultValue={text("address", store?.address ?? "")} className="field-input" />
        </Field>
        <Field label="Telefone" name="phone" errors={errors.phone}>
          <input id="phone" name="phone" type="tel" defaultValue={text("phone", store?.phone ?? "")} className="field-input" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          {WHATSAPP_FIELDS.map(({ name, label, hint }) => (
            <Field key={name} label={label} name={name} errors={errors[name]} hint={hint}>
              <input
                id={name}
                name={name}
                type="tel"
                inputMode="tel"
                required
                defaultValue={text(name, store ? formatWhatsapp(store[name]) : "")}
                aria-invalid={Boolean(errors[name])}
                className="field-input"
              />
            </Field>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={echoed ? echoed.active === "on" : (store?.active ?? true)}
            className="size-5 accent-olive"
          />
          Loja ativa (aparece no site)
        </label>
      </fieldset>

      <HoursEditor hours={parseStoredHours(store?.hours)} echoed={echoed} errors={errors} />

      <fieldset className="space-y-4">
        <legend className="mb-2 text-xl text-olive">Pagamento online</legend>
        <Field
          label="Conta de pagamento online"
          name="payment_account"
          errors={errors.payment_account}
          hint="Apelido da conta Stripe do CNPJ desta loja, ex. loja1. Deixe vazio para ficar só com WhatsApp."
        >
          <input
            id="payment_account"
            name="payment_account"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
            defaultValue={text("payment_account", store?.payment_account ?? "")}
            aria-invalid={Boolean(errors.payment_account)}
            className="field-input sm:max-w-xs"
          />
        </Field>
        {store && (
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2">
              Situação: <StatusBadge tone={PAYMENT_STATES[store.payment_state].tone}>{PAYMENT_STATES[store.payment_state].label}</StatusBadge>
            </p>
            <p className="text-cocoa-soft">{PAYMENT_STATES[store.payment_state].text}</p>
            {store.payment_state === "sem_chaves" && store.payment_account && (
              <p className="text-cocoa-soft">
                Variáveis esperadas: <code>{accountEnvNames(store.payment_account).secretKey}</code> e{" "}
                <code>{accountEnvNames(store.payment_account).webhookSecret}</code>.
              </p>
            )}
          </div>
        )}
      </fieldset>

      <SubmitButton className="btn btn-primary w-full sm:w-auto">{store ? "Salvar loja" : "Criar loja"}</SubmitButton>
    </form>
  );
}
