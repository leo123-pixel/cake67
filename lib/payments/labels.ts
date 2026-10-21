// Panel and public labels for online payments (spec 11).
import type { Enums } from "@/lib/database.types";

export type OrderPaymentStatus = Enums<"order_payment_status">;
export type PaymentAttemptStatus = Enums<"payment_attempt_status">;

// Badge next to the order status; null = no badge.
export const ORDER_PAYMENT_LABELS: Record<OrderPaymentStatus, string | null> = {
  nenhum: null,
  pagando: "Pagando",
  pago: "Pago",
  devolvendo: "Devolvendo",
  devolvido: "Devolvido",
  falha_devolucao: "Reembolso pendente",
  conferir: "Conferir",
};

export const ORDER_PAYMENT_TONES: Record<OrderPaymentStatus, "green" | "gray" | "amber" | "red"> = {
  nenhum: "gray",
  pagando: "amber",
  pago: "green",
  devolvendo: "amber",
  devolvido: "gray",
  falha_devolucao: "red",
  conferir: "red",
};

export const ATTEMPT_LABELS: Record<PaymentAttemptStatus, string> = {
  aberto: "Aberto",
  pago: "Pago",
  expirado: "Expirado",
  falhou: "Recusado",
  cancelado: "Cancelado",
  erro: "Não abriu",
  conferir: "Conferir",
  devolvendo: "Devolvendo",
  devolvido: "Devolvido",
  falha_devolucao: "Reembolso pendente",
};

// Attempts worth showing in the order detail: money that arrived, and what
// happened to it. Open, expired, refused and replaced sessions are noise.
const SHOWN: readonly PaymentAttemptStatus[] = ["pago", "conferir", "devolvendo", "devolvido", "falha_devolucao"];

export function shownAttempts<T extends { status: PaymentAttemptStatus }>(attempts: T[]): T[] {
  return attempts.filter((attempt) => SHOWN.includes(attempt.status));
}

const METHOD_LABELS: Record<string, string> = { pix: "Pix", card: "Cartão" };

export function methodLabel(method: string | null | undefined): string | null {
  return method ? (METHOD_LABELS[method] ?? null) : null;
}
