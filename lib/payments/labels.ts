// Display texts for online payments (site and panel).
import { formatBRL } from "@/lib/money";

type Status = "aguardando_pagamento" | "pago" | "expirado" | "cancelado" | "conferir";

export const PAYMENT_STATUS_LABELS: Record<Status, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago pelo site",
  expirado: "Link de pagamento expirado",
  cancelado: "Pagamento cancelado",
  conferir: "Pagamento a conferir",
};

export const PAYMENT_STATUS_TONES: Record<Status, "green" | "gray" | "amber" | "red"> = {
  aguardando_pagamento: "amber",
  pago: "green",
  expirado: "gray",
  cancelado: "gray",
  conferir: "red",
};

export function methodLabel(method: "credit_card" | "pix" | null): string {
  if (method === "pix") return "Pix";
  if (method === "credit_card") return "Cartão de crédito";
  return "Online";
}

// "Pix", "Cartão de crédito à vista", "Cartão de crédito em 3x".
export function describeMethod(method: "credit_card" | "pix" | null, installments: number | null): string {
  if (method !== "credit_card") return methodLabel(method);
  return installments && installments > 1 ? `Cartão de crédito em ${installments}x` : "Cartão de crédito à vista";
}

// Paid amount, with the installment interest when there is any.
export function describePaid(amountCents: number | null, paidAmountCents: number | null): string {
  if (paidAmountCents === null) return amountCents === null ? "—" : formatBRL(amountCents);
  if (amountCents !== null && paidAmountCents > amountCents) {
    return `${formatBRL(paidAmountCents)} (pedido ${formatBRL(amountCents)} + juros do parcelamento)`;
  }
  return formatBRL(paidAmountCents);
}
