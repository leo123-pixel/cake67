"use client";

import Form from "next/form";
import type { Store } from "@/lib/catalog";

// GET form: works without JS (submit button) and navigates client-side with it.
export function StorePicker({ stores, current }: { stores: Store[]; current: string }) {
  return (
    <Form action="/cardapio" className="flex items-center gap-2.5 text-sm">
      <label htmlFor="loja">Loja</label>
      <select
        id="loja"
        name="loja"
        defaultValue={current}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded-full border border-peach/30 bg-olive-dark px-4 py-2 text-linen"
      >
        {stores.map((store) => (
          <option key={store.id} value={store.slug}>
            {store.name} · {store.address}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="underline">
          Ver
        </button>
      </noscript>
    </Form>
  );
}
