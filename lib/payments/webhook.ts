// Turns a Stripe event of a store's account into the database calls of spec
// 11 (design: webhook table). Pure: the database and Stripe calls come in
// `deps`, so every event can be tested without network.
import type Stripe from "stripe";
import type { Enums } from "@/lib/database.types";

export type PaymentAction = "ok" | "refund" | "review" | "duplicate" | "ignore";
export type PaymentOutcome = { action: PaymentAction; payment_id?: string; payment_intent_id?: string | null };

// Stripe refund status as mark_refund takes it.
export type RefundStatus = "pending" | "requires_action" | "succeeded" | "failed" | "canceled";

export type SettleArgs = {
  account: string;
  sessionId: string;
  paymentIntentId: string | null;
  amountCents: number | null;
  currency: string | null;
  method: string | null;
};

export type MarkRefundArgs = {
  account: string;
  paymentId: string | null;
  paymentIntentId: string | null;
  refundId: string | null;
  status: RefundStatus;
  totalRefundedCents: number | null;
};

export type WebhookDeps = {
  settle(args: SettleArgs): Promise<PaymentOutcome>;
  close(account: string, sessionId: string, status: Extract<Enums<"payment_attempt_status">, "expirado" | "falhou">): Promise<PaymentOutcome>;
  markRefund(args: MarkRefundArgs): Promise<PaymentOutcome>;
  // "pix" or "card" of the payment, null when Stripe does not say.
  paymentMethod(paymentIntentId: string): Promise<string | null>;
  // Total refunded so far on a charge.
  chargeRefunded(chargeId: string): Promise<number>;
  refund(payment: { paymentId: string; paymentIntentId: string }): Promise<void>;
};

export type WebhookResult = { handled: boolean; outcome?: PaymentOutcome };

function id(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// payment_id set by refundPayment; refunds made in the Stripe dashboard have none.
function paymentIdOf(metadata: Stripe.Metadata | null): string | null {
  const value = metadata?.payment_id;
  return value && UUID.test(value) ? value : null;
}

function refundStatus(status: string | null): RefundStatus | null {
  return status === "pending" || status === "requires_action" || status === "succeeded" || status === "failed" || status === "canceled"
    ? status
    : null;
}

async function settleSession(account: string, session: Stripe.Checkout.Session, deps: WebhookDeps) {
  const paymentIntentId = id(session.payment_intent);
  const method = paymentIntentId ? await deps.paymentMethod(paymentIntentId).catch(() => null) : null;
  const outcome = await deps.settle({
    account,
    sessionId: session.id,
    paymentIntentId,
    amountCents: session.amount_total,
    currency: session.currency,
    method,
  });
  // The database decided the money has no order to go to (spec D10).
  if (outcome.action === "refund" && outcome.payment_id && outcome.payment_intent_id) {
    await deps.refund({ paymentId: outcome.payment_id, paymentIntentId: outcome.payment_intent_id });
  }
  return outcome;
}

export async function handleStripeEvent(account: string, event: Stripe.Event, deps: WebhookDeps): Promise<WebhookResult> {
  switch (event.type) {
    case "checkout.session.completed": {
      // Pix may complete the session before the money arrives: wait for the async event.
      if (event.data.object.payment_status !== "paid") return { handled: false };
      return { handled: true, outcome: await settleSession(account, event.data.object, deps) };
    }
    case "checkout.session.async_payment_succeeded":
      return { handled: true, outcome: await settleSession(account, event.data.object, deps) };
    case "checkout.session.async_payment_failed":
      return { handled: true, outcome: await deps.close(account, event.data.object.id, "falhou") };
    case "checkout.session.expired":
      return { handled: true, outcome: await deps.close(account, event.data.object.id, "expirado") };
    case "refund.created":
    case "refund.updated":
    case "refund.failed": {
      const refund = event.data.object;
      const status = refundStatus(refund.status);
      if (!status) return { handled: false };
      const chargeId = id(refund.charge);
      const total = status === "succeeded" && chargeId ? await deps.chargeRefunded(chargeId) : null;
      const outcome = await deps.markRefund({
        account,
        paymentId: paymentIdOf(refund.metadata),
        paymentIntentId: id(refund.payment_intent),
        refundId: refund.id,
        status,
        totalRefundedCents: total ?? (status === "succeeded" ? refund.amount : null),
      });
      return { handled: true, outcome };
    }
    default:
      return { handled: false };
  }
}
