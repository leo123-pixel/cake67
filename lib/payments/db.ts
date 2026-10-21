import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MarkRefundArgs, PaymentOutcome, SettleArgs } from "@/lib/payments/webhook";

// The service-role payment functions of migration 20261021000200. Errors are
// thrown: the webhook answers 500 and Stripe sends the event again.

export type BeginPayment = {
  payment_id: string;
  account: string;
  amount_cents: number;
  code: string;
  expires_at: string;
  stale_sessions: string[];
};

function fail(fn: string, error: { message: string; code?: string }): never {
  throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
}

export async function beginOrderPayment(code: string, token: string): Promise<BeginPayment> {
  const { data, error } = await createAdminClient().rpc("begin_order_payment", { p_code: code, p_token: token });
  if (error) fail("begin_order_payment", error);
  return data as unknown as BeginPayment;
}

// false: the attempt was replaced meanwhile and its session must be expired.
export async function attachPaymentSession(paymentId: string, sessionId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("attach_payment_session", {
    p_payment_id: paymentId,
    p_session_id: sessionId,
  });
  if (error) fail("attach_payment_session", error);
  return data;
}

export async function failPaymentAttempt(paymentId: string) {
  const { error } = await createAdminClient().rpc("fail_payment_attempt", { p_payment_id: paymentId });
  if (error) fail("fail_payment_attempt", error);
}

export async function settleOrderPayment(args: SettleArgs): Promise<PaymentOutcome> {
  const { data, error } = await createAdminClient().rpc("settle_order_payment", {
    p_account: args.account,
    p_session_id: args.sessionId,
    p_payment_intent_id: args.paymentIntentId,
    p_amount_cents: args.amountCents,
    p_currency: args.currency,
    p_method: args.method,
  });
  if (error) fail("settle_order_payment", error);
  return data as unknown as PaymentOutcome;
}

export async function closePaymentAttempt(account: string, sessionId: string, status: "expirado" | "falhou"): Promise<PaymentOutcome> {
  const { data, error } = await createAdminClient().rpc("close_payment_attempt", {
    p_account: account,
    p_session_id: sessionId,
    p_status: status,
  });
  if (error) fail("close_payment_attempt", error);
  return data as unknown as PaymentOutcome;
}

export async function markRefund(args: MarkRefundArgs): Promise<PaymentOutcome> {
  const { data, error } = await createAdminClient().rpc("mark_refund", {
    p_account: args.account,
    p_payment_id: args.paymentId,
    p_payment_intent_id: args.paymentIntentId,
    p_refund_id: args.refundId,
    p_refund_status: args.status,
    p_total_refunded_cents: args.totalRefundedCents,
  });
  if (error) fail("mark_refund", error);
  return data as unknown as PaymentOutcome;
}
