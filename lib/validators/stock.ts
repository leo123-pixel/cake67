import { z } from "zod";
import type { FieldErrors } from "./common";

export const MAX_STOCK = 9999;

export const stockQuantity = z
  .string()
  .trim()
  .min(1, "Informe a quantidade")
  .regex(/^\d+$/, "Use um número inteiro, sem vírgula")
  .transform(Number)
  .pipe(z.number().max(MAX_STOCK, `Máximo ${MAX_STOCK}`));

export const stockDelta = z.number().int().min(-MAX_STOCK).max(MAX_STOCK);

export type CountItem = { product_id: string; quantity: number };

const COUNT_PREFIX = "qty_";
const uuid = z.uuid();

export function countFieldName(productId: string) {
  return `${COUNT_PREFIX}${productId}`;
}

// Reads "qty_<productId>" fields. Returns every valid item plus per-field
// errors and the raw values (echoed back so the form keeps what was typed).
export function parseCountForm(formData: FormData) {
  const items: CountItem[] = [];
  const errors: FieldErrors = {};
  const values: Record<string, string> = {};

  for (const [key, raw] of formData) {
    if (!key.startsWith(COUNT_PREFIX) || typeof raw !== "string") continue;
    const productId = key.slice(COUNT_PREFIX.length);
    if (!uuid.safeParse(productId).success) continue;

    values[key] = raw;
    const quantity = stockQuantity.safeParse(raw);
    if (quantity.success) items.push({ product_id: productId, quantity: quantity.data });
    else errors[key] = [quantity.error.issues[0].message];
  }

  return { items, errors, values };
}
