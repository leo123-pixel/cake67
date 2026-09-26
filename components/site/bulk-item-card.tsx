"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatBRL } from "@/lib/money";
import type { MadeToOrderProduct } from "@/lib/storefront";
import { useCart } from "./use-cart";

// Cento (units in steps, priced per hundred) or kit (whole units).
export function BulkItemCard({ product }: { product: MadeToOrderProduct }) {
  const { add } = useCart();
  const isCento = product.type === "cento";
  const min = isCento ? (product.minQty ?? 25) : 1;
  const step = isCento ? (product.stepQty ?? 25) : 1;
  const max = isCento ? 2000 : 20;
  const [qty, setQty] = useState(min);
  const [added, setAdded] = useState(false);

  const total = isCento ? Math.round((product.priceCents * qty) / 100) : product.priceCents * qty;

  function change(delta: number) {
    setQty((q) => Math.min(max, Math.max(min, q + delta)));
    setAdded(false);
  }

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-cocoa/10 bg-white p-5">
      <div className="flex gap-4">
        <Image
          src={product.imageUrl}
          alt={product.name}
          width={96}
          height={96}
          unoptimized={product.imageUrl.endsWith(".svg")}
          className="size-24 shrink-0 rounded-2xl bg-peach-light object-contain"
        />
        <div className="min-w-0 space-y-1">
          <h3 className="text-xl text-olive">{product.name}</h3>
          <p className="text-sm text-cocoa-soft">
            {isCento ? `${formatBRL(product.priceCents)} o cento` : formatBRL(product.priceCents)}
          </p>
          {product.description && <p className="text-sm">{product.description}</p>}
          {product.kitContents && <p className="text-sm">Vem no kit: {product.kitContents}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" role="group" aria-label={`Quantidade de ${product.name}`}>
          <button type="button" onClick={() => change(-step)} disabled={qty <= min} aria-label="Menos" className="btn btn-secondary px-0 size-11">
            −
          </button>
          <span className="min-w-16 text-center tabular-nums">{isCento ? `${qty} un.` : qty}</span>
          <button type="button" onClick={() => change(step)} disabled={qty >= max} aria-label="Mais" className="btn btn-secondary px-0 size-11">
            +
          </button>
        </div>
        <span className="text-xl tabular-nums text-olive">{formatBRL(total)}</span>
      </div>

      <p className="text-xs text-cocoa-soft">Encomende com pelo menos {product.leadTimeHours} h de antecedência.</p>
      <button
        type="button"
        onClick={() => {
          add({
            productId: product.id,
            type: product.type,
            name: product.name,
            imageUrl: product.imageUrl,
            qty,
            // Adding the same cento again sums quantities, which keeps the step.
            minQty: min,
            stepQty: step,
          });
          setAdded(true);
        }}
        className="btn btn-primary"
      >
        Adicionar ao pedido
      </button>
      {added && (
        <p role="status" className="text-center text-sm">
          No pedido.{" "}
          <Link href="/carrinho" className="underline">
            Ver carrinho
          </Link>
        </p>
      )}
    </article>
  );
}
