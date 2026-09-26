"use client";

import Link from "next/link";
import { countStock } from "@/app/admin/(panel)/estoque/actions";
import { FormMessage } from "@/components/admin/field";
import { SubmitButton } from "@/components/admin/submit-button";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { StockGroup } from "@/lib/stock-grid";
import { countFieldName } from "@/lib/validators/stock";

type Props = { storeId: string; storeSlug: string; groups: StockGroup[] };

export function CountForm({ storeId, storeSlug, groups }: Props) {
  const [state, action, round] = useAdminForm(countStock.bind(null, storeId));
  const errors = state.fieldErrors ?? {};
  const back = `/admin/estoque?loja=${storeSlug}`;

  return (
    // noValidate: messages come from the server, consistent across browsers.
    <form key={round} action={action} noValidate className="space-y-6">
      <FormMessage state={state} />

      {groups.map((group) => (
        <fieldset key={group.categoryId} className="space-y-2">
          <legend className="mb-1 text-xl text-olive">{group.categoryName}</legend>
          {group.items.map((item) => {
            const name = countFieldName(item.productId);
            const error = errors[name]?.[0];
            const value = state.values ? String(state.values[name] ?? "") : String(item.quantity);
            return (
              <div key={item.productId} className="rounded-xl border border-cocoa/10 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor={name} className="min-w-0 truncate">
                    {item.name}
                  </label>
                  <input
                    id={name}
                    name={name}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    defaultValue={value}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${name}-error` : undefined}
                    className="field-input w-24 text-right tabular-nums"
                  />
                </div>
                {error && (
                  <p id={`${name}-error`} className="mt-1 text-right text-sm text-raspberry">
                    {error}
                  </p>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-cocoa/10 bg-linen/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <SubmitButton className="btn btn-primary flex-1 sm:flex-none">Salvar contagem</SubmitButton>
        <Link href={back} className="btn btn-secondary">
          {state.ok ? "Voltar ao estoque" : "Cancelar"}
        </Link>
      </div>
    </form>
  );
}
