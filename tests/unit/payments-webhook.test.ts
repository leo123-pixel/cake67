import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { handleStripeEvent, type PaymentOutcome, type WebhookDeps } from "@/lib/payments/webhook";

const PAYMENT_ID = "3f1c2a9e-7a51-4f0e-9d0c-1b2c3d4e5f60";

function deps(overrides: Partial<WebhookDeps> = {}) {
  return {
    settle: vi.fn(async (): Promise<PaymentOutcome> => ({ action: "ok", payment_id: PAYMENT_ID, payment_intent_id: "pi_1" })),
    close: vi.fn(async (): Promise<PaymentOutcome> => ({ action: "ok", payment_id: PAYMENT_ID })),
    markRefund: vi.fn(async (): Promise<PaymentOutcome> => ({ action: "ok", payment_id: PAYMENT_ID })),
    paymentMethod: vi.fn(async () => "pix"),
    chargeRefunded: vi.fn(async () => 2500),
    refund: vi.fn(async () => undefined),
    ...overrides,
  } satisfies WebhookDeps;
}

function event(type: string, object: Record<string, unknown>) {
  return { id: "evt_1", type, data: { object } } as unknown as Stripe.Event;
}

const session = { id: "cs_1", payment_status: "paid", payment_intent: "pi_1", amount_total: 2500, currency: "brl" };

describe("handleStripeEvent · Checkout Sessions", () => {
  it("settles a paid session with the payment method", async () => {
    const d = deps();
    const result = await handleStripeEvent("loja1", event("checkout.session.completed", session), d);
    expect(result).toEqual({ handled: true, outcome: { action: "ok", payment_id: PAYMENT_ID, payment_intent_id: "pi_1" } });
    expect(d.paymentMethod).toHaveBeenCalledWith("pi_1");
    expect(d.settle).toHaveBeenCalledWith({
      account: "loja1",
      sessionId: "cs_1",
      paymentIntentId: "pi_1",
      amountCents: 2500,
      currency: "brl",
      method: "pix",
    });
    expect(d.refund).not.toHaveBeenCalled();
  });

  it("waits for the money when a Pix completes the session unpaid", async () => {
    const d = deps();
    const result = await handleStripeEvent("loja1", event("checkout.session.completed", { ...session, payment_status: "unpaid" }), d);
    expect(result).toEqual({ handled: false });
    expect(d.settle).not.toHaveBeenCalled();
  });

  it("settles the asynchronous success, reading the intent id from an expanded object", async () => {
    const d = deps();
    await handleStripeEvent("loja1", event("checkout.session.async_payment_succeeded", { ...session, payment_intent: { id: "pi_1" } }), d);
    expect(d.settle).toHaveBeenCalledWith(expect.objectContaining({ paymentIntentId: "pi_1" }));
  });

  it("refunds what the database refuses (spec D10)", async () => {
    const d = deps({ settle: vi.fn(async () => ({ action: "refund", payment_id: PAYMENT_ID, payment_intent_id: "pi_1" }) as PaymentOutcome) });
    await handleStripeEvent("loja1", event("checkout.session.completed", session), d);
    expect(d.refund).toHaveBeenCalledWith({ paymentId: PAYMENT_ID, paymentIntentId: "pi_1" });
  });

  it("does not refund without a payment intent", async () => {
    const d = deps({ settle: vi.fn(async () => ({ action: "refund", payment_id: PAYMENT_ID, payment_intent_id: null }) as PaymentOutcome) });
    await handleStripeEvent("loja1", event("checkout.session.completed", session), d);
    expect(d.refund).not.toHaveBeenCalled();
  });

  it.each(["review", "duplicate", "ignore"] as const)("does nothing else on %s", async (action) => {
    const d = deps({ settle: vi.fn(async () => ({ action }) as PaymentOutcome) });
    const result = await handleStripeEvent("loja1", event("checkout.session.completed", session), d);
    expect(result.outcome?.action).toBe(action);
    expect(d.refund).not.toHaveBeenCalled();
  });

  it("still settles when the payment method cannot be read", async () => {
    const d = deps({ paymentMethod: vi.fn(async () => Promise.reject(new Error("network"))) });
    await handleStripeEvent("loja1", event("checkout.session.completed", session), d);
    expect(d.settle).toHaveBeenCalledWith(expect.objectContaining({ method: null }));
  });

  it("lets a database error through, so Stripe sends the event again", async () => {
    const d = deps({ settle: vi.fn(async () => Promise.reject(new Error("db down"))) });
    await expect(handleStripeEvent("loja1", event("checkout.session.completed", session), d)).rejects.toThrow("db down");
  });

  it.each([
    ["checkout.session.async_payment_failed", "falhou"],
    ["checkout.session.expired", "expirado"],
  ])("closes the attempt on %s", async (type, status) => {
    const d = deps();
    const result = await handleStripeEvent("loja1", event(type, session), d);
    expect(result.handled).toBe(true);
    expect(d.close).toHaveBeenCalledWith("loja1", "cs_1", status);
    expect(d.settle).not.toHaveBeenCalled();
  });
});

describe("handleStripeEvent · refunds", () => {
  const refund = {
    id: "re_1",
    status: "succeeded",
    amount: 1000,
    charge: "ch_1",
    payment_intent: "pi_1",
    metadata: { payment_id: PAYMENT_ID },
  };

  it("records a succeeded refund with the charge's total refunded", async () => {
    const d = deps();
    await handleStripeEvent("loja1", event("refund.updated", refund), d);
    expect(d.chargeRefunded).toHaveBeenCalledWith("ch_1");
    expect(d.markRefund).toHaveBeenCalledWith({
      account: "loja1",
      paymentId: PAYMENT_ID,
      paymentIntentId: "pi_1",
      refundId: "re_1",
      status: "succeeded",
      totalRefundedCents: 2500,
    });
  });

  it("finds a refund made in the Stripe dashboard by its payment intent", async () => {
    const d = deps();
    await handleStripeEvent("loja1", event("refund.failed", { ...refund, status: "failed", metadata: {} }), d);
    expect(d.chargeRefunded).not.toHaveBeenCalled();
    expect(d.markRefund).toHaveBeenCalledWith(expect.objectContaining({ paymentId: null, paymentIntentId: "pi_1", status: "failed", totalRefundedCents: null }));
  });

  it("ignores a payment_id that is not ours", async () => {
    const d = deps();
    await handleStripeEvent("loja1", event("refund.created", { ...refund, status: "pending", metadata: { payment_id: "x'; drop" } }), d);
    expect(d.markRefund).toHaveBeenCalledWith(expect.objectContaining({ paymentId: null, status: "pending" }));
  });

  it("falls back to the refund amount without a charge", async () => {
    const d = deps();
    await handleStripeEvent("loja1", event("refund.created", { ...refund, charge: null }), d);
    expect(d.markRefund).toHaveBeenCalledWith(expect.objectContaining({ totalRefundedCents: 1000 }));
  });

  it("skips an unknown refund status", async () => {
    const d = deps();
    expect(await handleStripeEvent("loja1", event("refund.updated", { ...refund, status: null }), d)).toEqual({ handled: false });
    expect(d.markRefund).not.toHaveBeenCalled();
  });
});

describe("handleStripeEvent · other events", () => {
  it("ignores events it does not subscribe to", async () => {
    const d = deps();
    expect(await handleStripeEvent("loja1", event("payment_intent.succeeded", {}), d)).toEqual({ handled: false });
    expect(d.settle).not.toHaveBeenCalled();
  });
});
