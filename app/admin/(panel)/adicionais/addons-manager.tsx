"use client";

import { Field, FormMessage } from "@/components/admin/field";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { MoneyInput } from "@/components/admin/money-input";
import { SortableList } from "@/components/admin/sortable-list";
import { StatusBadge } from "@/components/admin/status-badge";
import { SubmitButton } from "@/components/admin/submit-button";
import type { AdminAddon } from "@/lib/admin/catalog";
import { reorderItems } from "../reorder-action";
import { createAddon, updateAddon } from "./actions";

function NewAddonForm() {
  const [state, action, round] = useAdminForm(createAddon, { ok: false });
  return (
    <form key={round} action={action} className="space-y-4 rounded-2xl border border-cocoa/10 bg-white p-4">
      <h2 className="text-xl text-olive">Novo adicional</h2>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Field label="Nome" name="name" errors={state.fieldErrors?.name}>
          <input id="name" name="name" required className="field-input" />
        </Field>
        <Field label="Preço" name="price_cents" errors={state.fieldErrors?.price_cents}>
          <MoneyInput name="price_cents" required invalid={Boolean(state.fieldErrors?.price_cents)} />
        </Field>
      </div>
      <SubmitButton>Criar adicional</SubmitButton>
    </form>
  );
}

function AddonRow({ addon }: { addon: AdminAddon }) {
  const [state, action, round] = useAdminForm(updateAddon.bind(null, addon.id), { ok: false });
  const prefix = `addon-${addon.id}`;

  return (
    <form key={round} action={action} className="space-y-3">
      <StatusBadge tone={addon.active ? "green" : "gray"}>{addon.active ? "Oferecido" : "Desativado"}</StatusBadge>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <Field label="Nome" name={`${prefix}-name`} errors={state.fieldErrors?.name}>
          <input id={`${prefix}-name`} name="name" defaultValue={addon.name} required className="field-input" />
        </Field>
        <Field label="Preço" name={`${prefix}-price`} errors={state.fieldErrors?.price_cents}>
          <MoneyInput
            id={`${prefix}-price`}
            name="price_cents"
            defaultCents={addon.price_cents}
            required
            invalid={Boolean(state.fieldErrors?.price_cents)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={addon.active} className="size-5 accent-olive" />
          Oferecer nos bolos
        </label>
        <SubmitButton className="btn btn-secondary">Salvar</SubmitButton>
        {state.message && (
          <span role="status" className={`text-sm ${state.ok ? "text-olive" : "text-raspberry"}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

export function AddonsManager({ addons }: { addons: AdminAddon[] }) {
  return (
    <div className="space-y-8">
      <NewAddonForm />
      <SortableList
        items={addons}
        label={(addon) => addon.name}
        renderItem={(addon) => <AddonRow addon={addon} />}
        onReorder={(ids) => reorderItems("addons", ids)}
      />
    </div>
  );
}
