"use client";

import { useEffect, useState } from "react";
import { quoteCart, type Quote } from "@/app/(site)/actions";
import { toOrderItems, type Cart } from "@/lib/cart/cart";

type QuoteState = { quote: Quote | null; loading: boolean; error: string | null };

// Database quote for the cart in a store. Stale responses are ignored.
export function useQuote(storeId: string | null, cart: Cart): QuoteState {
  const items = toOrderItems(cart);
  const signature = storeId && items.length ? JSON.stringify([storeId, items]) : null;
  const [state, setState] = useState<QuoteState>({ quote: null, loading: false, error: null });

  useEffect(() => {
    if (!signature) return;
    const [store, lines] = JSON.parse(signature) as [string, unknown];
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    quoteCart(store, lines)
      .then((result) => {
        if (!active) return;
        setState(result.ok ? { quote: result.quote, loading: false, error: null } : { quote: null, loading: false, error: result.message });
      })
      .catch(() => {
        if (active) setState({ quote: null, loading: false, error: "Sem conexão. Tente de novo." });
      });
    return () => {
      active = false;
    };
  }, [signature]);

  return signature ? state : { quote: null, loading: false, error: null };
}
