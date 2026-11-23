"use client";

import Form from "next/form";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { rememberedStore } from "@/lib/cart/cart";
import type { Store } from "@/lib/catalog";
import { useCart } from "./use-cart";

// GET form: works without JS (submit button) and navigates client-side with it.
// With no store in the URL, it reopens the store of the items in the cart; otherwise the customer must pick one.
export function StorePicker({ stores, current }: { stores: Store[]; current: string }) {
  const router = useRouter();
  const { cart } = useCart();
  const remembered = rememberedStore(cart, stores.map((s) => s.slug));

  useEffect(() => {
    if (!current && remembered) router.replace(`/cardapio?loja=${remembered}`);
  }, [current, remembered, router]);

  const needed = !current;

  return (
    <Form action="/cardapio" className="flex w-full min-w-0 flex-col gap-2 text-sm sm:w-auto sm:flex-row sm:items-center sm:gap-2.5">
      <label
        htmlFor="loja"
        className={`text-xs font-semibold tracking-[0.14em] uppercase ${needed ? "text-peach" : "text-linen"}`}
      >
        Escolha a loja
      </label>
      <select
        id="loja"
        name="loja"
        key={current} // remount so defaultValue follows client-side navigation
        defaultValue={current}
        required
        aria-describedby={needed ? "loja-hint" : undefined}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className={`min-h-11 w-full min-w-0 max-w-full truncate rounded-full bg-olive-dark px-4 py-2 text-linen sm:w-auto ${
          needed ? "border-2 border-peach ring-4 ring-peach/20" : "border border-peach/30"
        }`}
      >
        <option value="" disabled>
          Selecione a loja…
        </option>
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
