// Order status rules for the panel. Mirrors advance_order/cancel_order in SQL,
// which remain the real guard.
import type { Enums } from "@/lib/database.types";

export type OrderStatus = Enums<"order_status">;

export const STATUS_LABELS: Record<OrderStatus, string> = {
  novo: "Novo",
  confirmado: "Confirmado",
  em_producao: "Em produção",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

export const STATUS_TONES: Record<OrderStatus, "green" | "gray" | "amber" | "red"> = {
  novo: "amber",
  confirmado: "green",
  em_producao: "green",
  pronto: "green",
  entregue: "gray",
  cancelado: "red",
  expirado: "gray",
};

// Button label for moving to a status.
export const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  confirmado: "Confirmar",
  em_producao: "Em produção",
  pronto: "Pronto",
  entregue: "Entregue",
};

export function nextStatuses(status: OrderStatus, hasMadeToOrder: boolean): OrderStatus[] {
  switch (status) {
    case "novo":
      return ["confirmado"];
    case "confirmado":
      return hasMadeToOrder ? ["em_producao"] : ["pronto", "entregue"];
    case "em_producao":
      return ["pronto"];
    case "pronto":
      return ["entregue"];
    default:
      return [];
  }
}

export function canCancel(status: OrderStatus): boolean {
  return status === "novo" || status === "confirmado" || status === "em_producao" || status === "pronto";
}

export const OTHER_REASON = "Outro";
export const CANCEL_REASONS = [
  "Cliente desistiu",
  "Não respondeu no WhatsApp",
  "Sem produção para a data",
  OTHER_REASON,
] as const;

// Whole minutes until the reservation expires (0 when past); null if none.
export function minutesLeft(expiresAt: string | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 60000));
}
