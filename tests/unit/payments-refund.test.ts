import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatBRL } from "@/lib/money";
import { refundNotice } from "@/lib/payments/labels";

// refundOrder/refundPayment with the database and the Stripe API replaced.
const rows = vi.hoisted(() => ({ data: [] as Record<string, unknown>[] }));
const stripe = vi.hoisted(() => ({ create: vi.fn() }));
const db = vi.hoisted(() => ({ markRefund: vi.fn(), settleOrderPayment: vi.fn(), closePaymentAttempt: vi.fn() }));
const checkout = vi.hoisted(() => ({ expireSessions: vi.fn(), createCheckout: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: rows.data, error: null }) }) }) }),
}));
vi.mock("@/lib/payments/stripe", () => ({ stripeFor: () => ({ stripe: { refunds: { create: stripe.create } } }) }));
vi.mock("@/lib/payments/db", () => db);
vi.mock("@/lib/payments/checkout", () => checkout);

const { refundOrder } = await import("@/lib/payments/refund");

const future = new Date(Date.now() + 3600_000).toISOString();
const past = new Date(Date.now() - 3600_000).toISOString();
const row = (overrides: Record<string, unknown>) => ({
  id: "p1",
  account: "loja1",
  status: "devolvendo",
  payment_intent_id: "pi_1",
  refund_id: null,
  amount_cents: 2500,
  session_id: "cs_1",
  expires_at: past,
  ...overrides,
});

beforeEach(() => {
  vi.stubEnv("STRIPE_LOJA1_SECRET_KEY", "sk_test_1");
  vi.stubEnv("STRIPE_LOJA1_WEBHOOK_SECRET", "whsec_1");
  stripe.create.mockResolvedValue({ id: "re_1", amount: 2500, status: "succeeded" });
  db.markRefund.mockResolvedValue({ action: "ok" });
  checkout.expireSessions.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("refundOrder", () => {
  it("refunds the payment marked by cancel_order, once per payment, and records it", async () => {
    rows.data = [row({})];
    expect(await refundOrder("o1")).toEqual([{ amountCents: 2500, status: "succeeded" }]);
    expect(stripe.create).toHaveBeenCalledWith(
      { payment_intent: "pi_1", metadata: { payment_id: "p1" } },
      { idempotencyKey: "refund-p1" },
    );
    expect(db.markRefund).toHaveBeenCalledWith({
      account: "loja1",
      paymentId: "p1",
      paymentIntentId: "pi_1",
      refundId: "re_1",
      status: "succeeded",
      totalRefundedCents: 2500,
    });
  });

  it("leaves alone what is paid, already refunding or failed (unless retrying)", async () => {
    rows.data = [row({ status: "pago" }), row({ id: "p2", refund_id: "re_x" }), row({ id: "p3", status: "falha_devolucao" })];
    expect(await refundOrder("o1")).toEqual([]);
    expect(stripe.create).not.toHaveBeenCalled();
  });

  it("retries a failed refund with a new idempotency key", async () => {
    rows.data = [row({ status: "falha_devolucao" })];
    await refundOrder("o1", { retry: true });
    expect(stripe.create.mock.calls[0][1].idempotencyKey).toMatch(/^refund-p1-\d+$/);
  });

  it("records a Stripe failure as failed, without throwing", async () => {
    rows.data = [row({})];
    stripe.create.mockRejectedValue(new Error("card_declined"));
    expect(await refundOrder("o1")).toEqual([{ amountCents: 2500, status: "failed" }]);
    expect(db.markRefund).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", refundId: null, totalRefundedCents: null }));
  });

  it("keeps a pending refund (Pix) as pending", async () => {
    rows.data = [row({})];
    stripe.create.mockResolvedValue({ id: "re_2", amount: 2500, status: "pending" });
    expect(await refundOrder("o1")).toEqual([{ amountCents: 2500, status: "pending" }]);
    expect(db.markRefund).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", totalRefundedCents: null }));
  });

  it("closes sessions the cancel left open, in their own account", async () => {
    rows.data = [row({ status: "cancelado", expires_at: future }), row({ id: "p2", status: "cancelado", session_id: "cs_old" })];
    await refundOrder("o1");
    expect(checkout.expireSessions).toHaveBeenCalledWith("loja1", ["cs_1"]);
  });
});

describe("refundNotice", () => {
  it("says nothing without refunds", () => {
    expect(refundNotice([], formatBRL)).toBeNull();
  });

  it("confirms a done refund with the total", () => {
    expect(refundNotice([{ amountCents: 2500, status: "succeeded" }], formatBRL)?.text).toBe(
      `Pagamento de ${formatBRL(2500)} devolvido ao cliente.`,
    );
  });

  it("warns that Pix refunds take a while", () => {
    expect(refundNotice([{ amountCents: 2500, status: "pending" }], formatBRL)).toMatchObject({ tone: "info" });
    expect(refundNotice([{ amountCents: 2500, status: "pending" }], formatBRL)?.text).toContain("pode levar alguns minutos");
  });

  it("points to the retry when a refund failed", () => {
    expect(refundNotice([{ amountCents: 2500, status: "succeeded" }, { amountCents: 100, status: "failed" }], formatBRL)).toEqual({
      text: "A devolução não foi feita. Use “Tentar devolver de novo”.",
      tone: "error",
    });
  });
});
