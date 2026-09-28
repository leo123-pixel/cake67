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

// Statuses after the store confirmed: the panel can (re)send the notice.
export const NOTIFY_STATUSES: readonly OrderStatus[] = ["confirmado", "em_producao", "pronto", "entregue"];

export type PublicStatus = { title: string; text: string };

// What the customer sees on their order link (spec 08).
export function publicStatus(status: OrderStatus, fulfillment: "retirada" | "entrega"): PublicStatus {
  switch (status) {
    case "novo":
      return { title: "Pedido recebido", text: "Falta um passo: envie o pedido para a loja pelo WhatsApp. O pagamento é combinado por lá." };
    case "confirmado":
      return { title: "Pedido confirmado", text: "A loja confirmou seu pedido. Qualquer dúvida, fale com ela pelo WhatsApp." };
    case "em_producao":
      return { title: "Em produção", text: "Seu pedido está sendo preparado." };
    case "pronto":
      return fulfillment === "entrega"
        ? { title: "Pronto para entrega", text: "A loja vai combinar a entrega com você pelo WhatsApp." }
        : { title: "Pronto para retirar", text: "Pode passar na loja para retirar." };
    case "entregue":
      return { title: "Pedido entregue", text: "Obrigado por pedir na Cake 67!" };
    case "cancelado":
      return { title: "Pedido cancelado", text: "Este pedido foi cancelado pela loja. Fale com ela pelo WhatsApp se tiver dúvidas." };
    case "expirado":
      return {
        title: "Reserva expirada",
        text: "O tempo para confirmar este pedido acabou e os itens voltaram para a vitrine. Fale com a loja para refazer.",
      };
  }
}
