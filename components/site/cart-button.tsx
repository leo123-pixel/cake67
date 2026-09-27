"use client";

import Link from "next/link";
import { countItems } from "@/lib/cart/cart";
import { useCart } from "./use-cart";

export function CartButton() {
  const { cart } = useCart();
  const count = countItems(cart);

  return (
    <Link
      href="/carrinho"
      aria-label={count ? `Carrinho, ${count} itens` : "Carrinho vazio"}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-peach/40 px-4 text-xs font-semibold tracking-[0.14em] uppercase hover:border-peach"
    >
      Pedido
      <span className="grid min-w-6 place-items-center rounded-full bg-peach px-1.5 py-0.5 text-cocoa tabular-nums">
        {count}
      </span>
    </Link>
  );
}
