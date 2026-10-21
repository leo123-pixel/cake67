// What the public order page shows about the payment (spec 11, P1 Página do
// pedido). Pure: built from get_order_public and the ?pagamento= the page got
// back from Stripe.
import type { OrderStatus } from "@/lib/order-status";
import { methodLabel, type OrderPaymentStatus } from "@/lib/payments/labels";

export type PublicPayment = {
  status: OrderPaymentStatus;
  method: string | null;
  attempts_left: number;
  store_has_account: boolean;
};

export type ReturnFromStripe = "ok" | "cancelado" | "erro" | null;

export type PaymentView = {
  // Replaces the status text of a new order.
  statusText: string | null;
  // Short note above the buttons, after coming back from Stripe.
  notice: { text: string; tone: "info" | "error" } | null;
  canPay: boolean;
  // Keep refreshing while the payment is being confirmed.
  poll: boolean;
  // Badge in the summary: "Pago pelo site · Pix", "Pagamento devolvido"...
  badge: string | null;
  paid: boolean;
};

export function parseReturn(value: string | string[] | undefined): ReturnFromStripe {
  return value === "ok" || value === "cancelado" || value === "erro" ? value : null;
}

export function paymentView(status: OrderStatus, payment: PublicPayment | undefined, back: ReturnFromStripe): PaymentView {
  const p = payment ?? { status: "nenhum", method: null, attempts_left: 0, store_has_account: false };
  const isNew = status === "novo";
  const paid = p.status === "pago";
  const open = p.status === "nenhum" || p.status === "pagando";
  const canPay = isNew && open && p.store_has_account && p.attempts_left > 0;
  const method = methodLabel(p.method);

  let notice: PaymentView["notice"] = null;
  if (back === "ok" && isNew && open) notice = { text: "Confirmando o pagamento…", tone: "info" };
  else if (back === "ok" && paid) notice = { text: "Pagamento recebido. Obrigado!", tone: "info" };
  else if (back === "cancelado" && canPay) notice = { text: "Pagamento não concluído. Você pode tentar de novo ou finalizar pelo WhatsApp.", tone: "error" };
  else if (back === "erro" && isNew && open)
    notice = { text: "Não conseguimos abrir o pagamento agora. Tente de novo ou finalize pelo WhatsApp.", tone: "error" };

  let statusText: string | null = null;
  if (isNew && paid) statusText = "Pagamento recebido. A loja vai confirmar seu pedido e avisar no WhatsApp.";
  else if (isNew && p.status === "conferir") statusText = "Recebemos um pagamento que a loja precisa conferir. Ela fala com você pelo WhatsApp.";
  else if (canPay) statusText = "Falta um passo: pague pelo site ou envie o pedido para a loja pelo WhatsApp.";

  const badge = paid
    ? `Pago pelo site${method ? ` · ${method}` : ""}`
    : p.status === "devolvido"
      ? "Pagamento devolvido"
      : p.status === "devolvendo" || p.status === "falha_devolucao"
        ? "Devolução do pagamento em andamento"
        : p.status === "conferir"
          ? "Pagamento em conferência"
          : null;

  return { statusText, notice, canPay, poll: back === "ok" && isNew && open, badge, paid };
}
