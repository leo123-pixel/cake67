// Cart kept in the browser (localStorage). It only says WHAT the customer
// wants; prices and availability always come from quote_order.

export type ProductKind = "vitrine" | "bolo_kg" | "cento" | "kit";

export type CartOptions = {
  weight_kg?: string;
  format?: string;
  addon_ids?: string[];
  message?: string;
};

export type CartLine = {
  key: string;
  productId: string;
  type: ProductKind;
  name: string;
  imageUrl: string;
  qty: number;
  // Human-readable options, e.g. "2 kg · Retangular · Velas".
  label?: string;
  options?: CartOptions;
  // Quantity stepper for cento (units) in the cart; defaults to 1/1.
  minQty?: number;
  stepQty?: number;
};

export type Cart = { storeSlug: string | null; lines: CartLine[] };

export const EMPTY_CART: Cart = { storeSlug: null, lines: [] };
export const MAX_VITRINE_QTY = 10;
export const MAX_LINES = 30;

export function lineKey(productId: string, options?: CartOptions): string {
  if (!options) return productId;
  const normalized = {
    ...options,
    addon_ids: options.addon_ids ? [...options.addon_ids].sort() : undefined,
    message: options.message?.trim() || undefined,
  };
  return `${productId}:${JSON.stringify(normalized, Object.keys(normalized).sort())}`;
}

function clampQty(type: ProductKind, qty: number) {
  return type === "vitrine" ? Math.min(qty, MAX_VITRINE_QTY) : qty;
}

export function addLine(cart: Cart, line: Omit<CartLine, "key">): Cart {
  const key = lineKey(line.productId, line.options);
  const existing = cart.lines.find((l) => l.key === key);
  if (existing) {
    return {
      ...cart,
      lines: cart.lines.map((l) => (l.key === key ? { ...l, qty: clampQty(l.type, l.qty + line.qty) } : l)),
    };
  }
  if (cart.lines.length >= MAX_LINES) return cart;
  return { ...cart, lines: [...cart.lines, { ...line, key, qty: clampQty(line.type, line.qty) }] };
}

export function setQty(cart: Cart, key: string, qty: number): Cart {
  if (qty <= 0) return removeLine(cart, key);
  return { ...cart, lines: cart.lines.map((l) => (l.key === key ? { ...l, qty: clampQty(l.type, qty) } : l)) };
}

export function removeLine(cart: Cart, key: string): Cart {
  return { ...cart, lines: cart.lines.filter((l) => l.key !== key) };
}

export function countItems(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + (l.type === "cento" ? 1 : l.qty), 0);
}

export type OrderItemInput = {
  product_id: string;
  qty: number;
  weight_kg?: string;
  format?: string;
  addon_ids?: string[];
  message?: string;
};

export function toOrderItems(cart: Cart): OrderItemInput[] {
  return cart.lines.map((l) => ({ product_id: l.productId, qty: l.qty, ...l.options }));
}

// Defensive parse of what was stored in localStorage.
export function parseStoredCart(raw: string | null): Cart {
  if (!raw) return EMPTY_CART;
  try {
    const value = JSON.parse(raw) as Partial<Cart>;
    if (!Array.isArray(value.lines)) return EMPTY_CART;
    const lines = value.lines.filter(
      (l): l is CartLine =>
        typeof l?.key === "string" && typeof l.productId === "string" && Number.isInteger(l.qty) && l.qty > 0,
    );
    return { storeSlug: typeof value.storeSlug === "string" ? value.storeSlug : null, lines: lines.slice(0, MAX_LINES) };
  } catch {
    return EMPTY_CART;
  }
}
