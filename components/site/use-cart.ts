"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  addLine,
  EMPTY_CART,
  parseStoredCart,
  removeLine,
  setQty,
  type Cart,
  type CartLine,
} from "@/lib/cart/cart";

const STORAGE_KEY = "cake67.cart.v1";
const listeners = new Set<() => void>();
let current: Cart | null = null;

function read(): Cart {
  if (current) return current;
  try {
    current = parseStoredCart(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    current = EMPTY_CART; // storage blocked: keep the cart in memory only
  }
  return current;
}

function write(next: Cart) {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage blocked or full: the cart still works for this page session
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep tabs in sync.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    current = parseStoredCart(event.newValue);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart() {
  const cart = useSyncExternalStore(subscribe, read, () => EMPTY_CART);

  return {
    cart,
    add: useCallback((line: Omit<CartLine, "key">, storeSlug?: string) => {
      const base = read();
      write(addLine(storeSlug ? { ...base, storeSlug } : base, line));
    }, []),
    setQty: useCallback((key: string, qty: number) => write(setQty(read(), key, qty)), []),
    remove: useCallback((key: string) => write(removeLine(read(), key)), []),
    setStore: useCallback((storeSlug: string) => write({ ...read(), storeSlug }), []),
    clear: useCallback(() => write({ ...read(), lines: [] }), []),
  };
}
