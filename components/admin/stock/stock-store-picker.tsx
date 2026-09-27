"use client";

import Form from "next/form";
import type { StockStore } from "@/lib/admin/stock-store";

// Admin-only store switch (GET form: works without JS, navigates with it).
export function StockStorePicker({
  action,
  stores,
  current,
  allowAll,
}: {
  action: string;
  stores: StockStore[];
  current: string;
  allowAll: boolean;
}) {
  return (
    <Form action={action} className="flex items-center gap-2 text-sm">
      <label htmlFor="loja">Loja</label>
      <select
        id="loja"
        name="loja"
        defaultValue={current}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="field-input w-auto"
      >
        {stores.map((store) => (
          <option key={store.id} value={store.slug}>
            {store.name}
          </option>
        ))}
        {allowAll && <option value="todas">Todas as lojas</option>}
      </select>
      <noscript>
        <button type="submit" className="btn btn-secondary">
          Ver
        </button>
      </noscript>
    </Form>
  );
}
