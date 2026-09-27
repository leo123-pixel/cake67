"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { countItems } from "@/lib/cart/cart";
import { CART_BUTTON_ID } from "@/lib/site-events";
import { useCart } from "./use-cart";

export function CartButton() {
  const { cart } = useCart();
  const count = countItems(cart);
  const button = useRef<HTMLAnchorElement>(null);
  const previous = useRef(count);

  // Pulses when something is added, as in the prototype.
  useEffect(() => {
    const element = button.current;
    if (element && count > previous.current) {
      element.classList.remove("ck-bump");
      void element.offsetWidth;
      element.classList.add("ck-bump");
    }
    previous.current = count;
  }, [count]);

  return (
    <Link
      ref={button}
      id={CART_BUTTON_ID}
      href="/carrinho"
      aria-label={count ? `Pedido, ${count} itens` : "Pedido vazio"}
      className="ck-cart"
    >
      Pedido <span className="ck-n">{count}</span>
    </Link>
  );
}
