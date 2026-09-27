"use client";

import Image from "next/image";
import Link from "next/link";
import { MAX_VITRINE_QTY, type CartLine } from "@/lib/cart/cart";
import { formatBRL } from "@/lib/money";
import type { CheckoutStore } from "@/lib/storefront";
import { useCart } from "./use-cart";
import { useQuote } from "./use-quote";

const MAX_BY_TYPE = { vitrine: MAX_VITRINE_QTY, bolo_kg: 5, cento: 2000, kit: 20 } as const;

function stepFor(line: CartLine) {
  return line.type === "cento" ? (line.stepQty ?? 25) : 1;
}

function minFor(line: CartLine) {
  return line.type === "cento" ? (line.minQty ?? 25) : 1;
}

export function resolveStore(stores: CheckoutStore[], slug: string | null) {
  return stores.find((s) => s.slug === slug) ?? stores[0] ?? null;
}

export function CartView({ stores }: { stores: CheckoutStore[] }) {
  const { cart, setQty, remove, setStore } = useCart();
  const store = resolveStore(stores, cart.storeSlug);
  const { quote, loading, error } = useQuote(store?.id ?? null, cart);

  if (cart.lines.length === 0) {
    return (
      <div className="space-y-4 rounded-3xl border border-cocoa/10 bg-white p-8">
        <p className="text-lg">Seu pedido está vazio.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/cardapio" className="btn btn-primary">
            Ver a vitrine
          </Link>
          <Link href="/encomendas" className="btn btn-secondary">
            Encomendas
          </Link>
        </div>
      </div>
    );
  }

  const problems = quote?.lines.filter((l) => l.problem) ?? [];
  const blocked = !quote || loading || problems.length > 0 || !quote.store_available;

  return (
    <div className="space-y-6">
      <label className="flex flex-wrap items-center gap-3 text-sm font-medium">
        Loja
        <select value={store?.slug ?? ""} onChange={(e) => setStore(e.target.value)} className="field-input w-auto">
          {stores.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name} · {s.address}
            </option>
          ))}
        </select>
      </label>

      <ul className="divide-y divide-cocoa/10 overflow-hidden rounded-3xl border border-cocoa/10 bg-white">
        {cart.lines.map((line, index) => {
          const quoted = quote?.lines[index];
          const step = stepFor(line);
          return (
            <li key={line.key} className={`flex gap-3 p-4 ${quoted?.problem ? "bg-raspberry/5" : ""}`}>
              <Image
                src={line.imageUrl}
                alt=""
                width={64}
                height={64}
                unoptimized={line.imageUrl.endsWith(".svg")}
                className="size-16 shrink-0 rounded-xl bg-olive object-contain"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{line.name}</p>
                    {line.label && <p className="text-sm text-cocoa-soft">{line.label}</p>}
                  </div>
                  <span className="shrink-0 tabular-nums">{quoted && !quoted.problem ? formatBRL(quoted.total_cents) : "—"}</span>
                </div>
                {quoted?.problem && (
                  <p role="alert" className="text-sm font-medium text-raspberry">
                    {quoted.problem_text}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Menos ${line.name}`}
                    onClick={() => setQty(line.key, line.qty - step < minFor(line) ? 0 : line.qty - step)}
                    className="btn btn-secondary size-11 px-0"
                  >
                    −
                  </button>
                  <span className="min-w-14 text-center tabular-nums">{line.type === "cento" ? `${line.qty} un.` : line.qty}</span>
                  <button
                    type="button"
                    aria-label={`Mais ${line.name}`}
                    disabled={line.qty + step > MAX_BY_TYPE[line.type]}
                    onClick={() => setQty(line.key, line.qty + step)}
                    className="btn btn-secondary size-11 px-0"
                  >
                    +
                  </button>
                  <button type="button" onClick={() => remove(line.key)} className="ml-auto text-sm text-raspberry underline">
                    Remover
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {error && <p role="alert" className="text-raspberry">{error}</p>}
      {quote && !quote.store_available && (
        <p role="alert" className="text-raspberry">Esta loja não está recebendo pedidos agora. Escolha outra.</p>
      )}
      {problems.length > 0 && (
        <p role="alert" className="text-raspberry">
          Ajuste os itens marcados (remova ou troque de loja) para continuar.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-olive p-5 text-linen">
        <div>
          <p className="text-sm text-linen/80">Subtotal</p>
          <p className="text-2xl tabular-nums text-peach">{quote ? formatBRL(quote.subtotal_cents) : "…"}</p>
        </div>
        {blocked ? (
          <span aria-disabled className="btn cursor-not-allowed bg-peach/50 text-cocoa">
            {loading || !quote ? "Calculando…" : "Continuar"}
          </span>
        ) : (
          <Link href="/checkout" className="btn bg-peach text-cocoa hover:bg-peach-light">
            Continuar
          </Link>
        )}
      </div>
    </div>
  );
}
