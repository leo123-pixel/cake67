"use client";

import { MAX_VITRINE_QTY } from "@/lib/cart/cart";
import { useCart } from "./use-cart";

type Props = {
  productId: string;
  name: string;
  imageUrl: string;
  availableQty: number;
  storeSlug: string;
  label?: string;
};

// Vitrine item: adds 1 per tap, up to what the store has (max 10).
export function AddToCart({ productId, name, imageUrl, availableQty, storeSlug, label = "Adicionar" }: Props) {
  const { cart, add } = useCart();
  const inCart = cart.storeSlug === storeSlug ? (cart.lines.find((l) => l.key === productId)?.qty ?? 0) : 0;
  const limit = Math.min(availableQty, MAX_VITRINE_QTY);
  const full = inCart >= limit;

  if (availableQty <= 0) return null;

  return (
    <button
      type="button"
      disabled={full}
      onClick={() => add({ productId, type: "vitrine", name, imageUrl, qty: 1 }, storeSlug)}
      className="min-h-9 rounded-full border border-peach px-3 text-[0.68rem] font-semibold tracking-[0.12em] text-peach uppercase transition hover:bg-peach hover:text-cocoa disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-peach"
    >
      {inCart > 0 ? (full ? `${inCart} no pedido` : `${label} (${inCart})`) : label}
    </button>
  );
}
