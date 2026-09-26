"use client";

import { Field, FormMessage } from "@/components/admin/field";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { HoursEditor } from "@/components/admin/hours-editor";
import { SubmitButton } from "@/components/admin/submit-button";
import type { AdminStore } from "@/lib/admin/catalog";
import { formatWhatsapp } from "@/lib/phone";
import { parseStoredHours } from "@/lib/validators/store";
import { saveStore } from "./actions";

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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone" name="phone" errors={errors.phone}>
            <input id="phone" name="phone" type="tel" defaultValue={text("phone", store?.phone ?? "")} className="field-input" />
          </Field>
          <Field label="WhatsApp" name="whatsapp" errors={errors.whatsapp} hint="Com DDD, ex. (67) 98151-9796">
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="tel"
              required
              defaultValue={text("whatsapp", store ? formatWhatsapp(store.whatsapp) : "")}
              aria-invalid={Boolean(errors.whatsapp)}
              className="field-input"
            />
          </Field>
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

      <SubmitButton className="btn btn-primary w-full sm:w-auto">{store ? "Salvar loja" : "Criar loja"}</SubmitButton>
    </form>
  );
}
