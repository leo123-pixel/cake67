import { z } from "zod";

// Delivery address in fields (spec 11, D5). City is always Campo Grande - MS.
export function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

const text = (max: number, message: string) =>
  z.string({ error: message }).transform(collapseSpaces).pipe(z.string().min(1, message).max(max, `Use até ${max} caracteres`));
const optional = (max: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value?.trim() ? collapseSpaces(value).slice(0, max) : undefined));

export const deliveryAddressSchema = z.object({
  delivery_street: text(120, "Informe a rua"),
  delivery_number: text(20, "Informe o número"),
  delivery_complement: optional(60),
  delivery_district: text(80, "Informe o bairro"),
  delivery_reference: optional(120),
});

export type DeliveryAddressInput = z.output<typeof deliveryAddressSchema>;

// Key to reuse a recent quote. Case is kept on purpose: create_order compares
// with lower() in SQL, which is looser, so a reused quote always passes there
// (JavaScript and Postgres may lowercase accented letters differently).
export function addressKey(address: { street: string; number: string; district: string }): string {
  return [address.street, address.number, address.district].map(collapseSpaces).join("|");
}

// The three fields Juma needs; without them the fee cannot be calculated.
export function hasQuotableAddress(fields: Record<string, string | undefined>): boolean {
  return Boolean(fields.delivery_street?.trim() && fields.delivery_number?.trim() && fields.delivery_district?.trim());
}
