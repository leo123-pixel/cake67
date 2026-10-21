import "server-only";
import { readAccount } from "@/lib/payments/accounts";
import { expireSessions } from "@/lib/payments/checkout";
import type { RefundResult } from "@/lib/payments/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { closePaymentAttempt, markRefund, settleOrderPayment } from "@/lib/payments/db";
import { stripeFor } from "@/lib/payments/stripe";
import type { RefundStatus, WebhookDeps } from "@/lib/payments/webhook";

// Full refund of a payment in the account it was made (spec D7, D10, D11),
// recorded with mark_refund. Never throws: a failure is recorded as
// "falha_devolucao" and the panel offers a retry.
//
// The idempotency key repeats for the same payment, so a webhook and the
// panel asking at once produce one refund. A retry after a failure needs a new
// key (Stripe replays the stored error for 24 h); refunding more than was paid
// is refused by Stripe itself.
export async function refundPayment(
  account: string,
  payment: { paymentId: string; paymentIntentId: string },
  { retry = false } = {},
): Promise<RefundStatus> {
  let status: RefundStatus = "failed";
  let refundId: string | null = null;
  let amount: number | null = null;
  try {
    const { stripe } = stripeFor(account);
    const refund = await stripe.refunds.create(
      { payment_intent: payment.paymentIntentId, metadata: { payment_id: payment.paymentId } },
      { idempotencyKey: retry ? `refund-${payment.paymentId}-${Date.now()}` : `refund-${payment.paymentId}` },
    );
    refundId = refund.id;
    amount = refund.amount;
    status = (["pending", "requires_action", "succeeded", "failed", "canceled"] as const).find((s) => s === refund.status) ?? "pending";
  } catch (error) {
    console.error(`Refund of payment ${payment.paymentId} failed: ${error instanceof Error ? error.message : error}`);
  }

  try {
    await markRefund({
      account,
      paymentId: payment.paymentId,
      paymentIntentId: payment.paymentIntentId,
      refundId,
      status,
      totalRefundedCents: status === "succeeded" ? amount : null,
    });
  } catch (error) {
    // The refund.* webhook records it later.
    console.error(`Could not record the refund of payment ${payment.paymentId}: ${error instanceof Error ? error.message : error}`);
  }
  return status;
}

// After cancel_order (or on "Tentar devolver de novo"): refunds what the
// database marked for refund and closes sessions the cancel left open, each in
// the account it belongs to (D7). Callers check access first: this reads with
// the service role.
export async function refundOrder(orderId: string, { retry = false } = {}): Promise<RefundResult[]> {
  const { data, error } = await createAdminClient()
    .from("order_payments")
    .select("id, account, status, payment_intent_id, refund_id, amount_cents, session_id, expires_at")
    .eq("order_id", orderId);
  if (error) throw new Error(`Could not load payments of ${orderId}: ${error.message}`);

  const now = Date.now();
  const open = data.filter((p) => p.status === "cancelado" && p.session_id && Date.parse(p.expires_at) > now);
  for (const account of new Set(open.map((p) => p.account))) {
    if (!readAccount(account)) continue;
    await expireSessions(
      account,
      open.filter((p) => p.account === account).map((p) => p.session_id!),
    );
  }

  const due = data.filter(
    (p) => p.payment_intent_id && ((p.status === "devolvendo" && !p.refund_id) || (retry && p.status === "falha_devolucao")),
  );
  return Promise.all(
    due.map(async (p) => ({
      amountCents: p.amount_cents,
      status: await refundPayment(p.account, { paymentId: p.id, paymentIntentId: p.payment_intent_id! }, { retry }),
    })),
  );
}

// What handleStripeEvent needs for a store's account.
export function webhookDeps(account: string): WebhookDeps {
  const { stripe } = stripeFor(account);
  return {
    settle: settleOrderPayment,
    close: closePaymentAttempt,
    markRefund,
    async paymentMethod(paymentIntentId) {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
      const charge = intent.latest_charge;
      return typeof charge === "object" && charge ? (charge.payment_method_details?.type ?? null) : null;
    },
    async chargeRefunded(chargeId) {
      return (await stripe.charges.retrieve(chargeId)).amount_refunded;
    },
    async refund(payment) {
      await refundPayment(account, payment);
    },
  };
}
