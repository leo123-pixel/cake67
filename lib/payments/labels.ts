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

export type RefundResult = { amountCents: number; status: "pending" | "requires_action" | "succeeded" | "failed" | "canceled" };

// What the panel says after asking Stripe for refunds (spec D11).
export function refundNotice(results: RefundResult[], formatBRL: (cents: number) => string): { text: string; tone: "info" | "error" } | null {
  if (results.length === 0) return null;
  if (results.some((r) => r.status === "failed" || r.status === "canceled")) {
    return { text: "A devolução não foi feita. Use “Tentar devolver de novo”.", tone: "error" };
  }
  const total = formatBRL(results.reduce((sum, r) => sum + r.amountCents, 0));
  return results.every((r) => r.status === "succeeded")
    ? { text: `Pagamento de ${total} devolvido ao cliente.`, tone: "info" }
    : { text: `Devolução de ${total} pedida à Stripe. No Pix pode levar alguns minutos.`, tone: "info" };
}

// CSV columns of an order (spec 11, P2): how it was paid through the site and
// how much went back. Empty when the order was paid on WhatsApp.
export function paymentColumns(attempts: { status: PaymentAttemptStatus; method: string | null; refunded_cents: number }[]) {
  const shown = shownAttempts(attempts);
  const main = shown.find((a) => a.status === "pago") ?? shown[0];
  const refunded = shown.reduce((sum, a) => sum + a.refunded_cents, 0);
  return { method: main ? (methodLabel(main.method) ?? "Site") : "", refundedCents: refunded > 0 ? refunded : null };
}

const METHOD_LABELS: Record<string, string> = { pix: "Pix", card: "Cartão" };

export function methodLabel(method: string | null | undefined): string | null {
  return method ? (METHOD_LABELS[method] ?? null) : null;
}
