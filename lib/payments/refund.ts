import "server-only";
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
