// Customer-facing timeline of an order (spec 09), built from the public status
// history returned by get_order_public.
import type { OrderStatus } from "@/lib/order-status";

export type OrderEvent = { status: OrderStatus; at: string };

export type TimelineStep = {
  key: OrderStatus;
  label: string;
  state: "done" | "current" | "upcoming";
  at: string | null;
};

// Cancelled or expired: closes the timeline instead of the upcoming steps.
export type TimelineEnd = { label: string; at: string | null } | null;

export type TimelineOrder = {
  status: OrderStatus;
  created_at: string;
  has_made_to_order: boolean;
  fulfillment: "retirada" | "entrega";
  events: OrderEvent[];
};

const END_LABELS: Partial<Record<OrderStatus, string>> = {
  cancelado: "Pedido cancelado",
  expirado: "Reserva expirada",
};

function path(hasMadeToOrder: boolean): OrderStatus[] {
  return hasMadeToOrder
    ? ["novo", "confirmado", "em_producao", "pronto", "entregue"]
    : ["novo", "confirmado", "pronto", "entregue"];
}

function label(status: OrderStatus, fulfillment: TimelineOrder["fulfillment"]): string {
  const delivery = fulfillment === "entrega";
  switch (status) {
    case "novo":
      return "Pedido recebido";
    case "confirmado":
      return "Confirmado";
    case "em_producao":
      return "Em produção";
    case "pronto":
      return delivery ? "Pronto para entrega" : "Pronto para retirar";
    case "entregue":
      return delivery ? "Entregue" : "Retirado";
    default:
      return END_LABELS[status] ?? status;
  }
}

// The last time the order entered this status (D5).
function lastAt(events: OrderEvent[], status: OrderStatus): string | null {
  return events.findLast((event) => event.status === status)?.at ?? null;
}

export function buildTimeline(order: TimelineOrder): { steps: TimelineStep[]; end: TimelineEnd } {
  const statuses = path(order.has_made_to_order);
  const endLabel = END_LABELS[order.status];
  // Orders only move forward (reactivation goes to confirmado), so on a
  // cancelled or expired order the furthest step with an event is where it stopped.
  const reached = endLabel
    ? Math.max(0, ...statuses.map((status, index) => (lastAt(order.events, status) ? index : 0)))
    : statuses.indexOf(order.status);

  // A delivered order is finished: its last step is done, not in progress.
  const finished = Boolean(endLabel) || order.status === "entregue";

  const steps = statuses
    .map((status, index): TimelineStep => {
      const state = index < reached || (finished && index === reached) ? "done" : index === reached ? "current" : "upcoming";
      const at = status === "novo" ? order.created_at : state === "upcoming" ? null : lastAt(order.events, status);
      return { key: status, label: label(status, order.fulfillment), state, at };
    })
    .filter((step) => !endLabel || step.state === "done");

  const end = endLabel ? { label: endLabel, at: lastAt(order.events, order.status) } : null;
  return { steps, end };
}
