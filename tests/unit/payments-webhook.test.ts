import { describe, expect, it, vi } from "vitest";
import type { CheckResult } from "@/lib/infinitepay";
import {
  confirmTransaction,
  handleWebhook,
  safeReceipt,
  webhookStatus,
  type ConfirmDeps,
  type OrderForPayment,
  type PaymentEvent,
  type SettleInput,
} from "@/lib/payments/confirm";

const ORDER_ID = "6f1c2b9e-6a39-4b8a-9d0e-0f4d7f3f5a11";
const TIMEOUT = 700;

const paid: CheckResult = {
  ok: true,
  paid: true,
  amountCents: 3000,
  paidAmountCents: 3000,
  installments: 1,
  captureMethod: "pix",
  raw: { success: true, paid: true },
};

// In-memory stand-ins that behave like the database: settle_online_payment
// ignores a transaction it already stored.
function setup(check: CheckResult | (() => Promise<CheckResult>) = paid, order: Partial<OrderForPayment> | null = {}) {
  const events: PaymentEvent[] = [];
  const row: OrderForPayment | null =
    order === null ? null : { id: ORDER_ID, payment_handle: "cake-zsf", transaction_nsu: null, ...order };
  const settled: SettleInput[] = [];

  const deps: ConfirmDeps = {
    record: vi.fn(async (event: PaymentEvent) => {
      events.push(event);
    }),
    findOrder: vi.fn(async (id: string) => (row && row.id === id ? { ...row } : null)),
    account: vi.fn((handle: string | null) => (handle === "cake-zsf" ? { handle, apiKey: "inchk_test" } : null)),
    check: vi.fn(typeof check === "function" ? check : async () => check),
    settle: vi.fn(async (input: SettleInput) => {
      settled.push(input);
      if (row!.transaction_nsu === input.transactionNsu) return "duplicate";
      row!.transaction_nsu = input.transactionNsu;
      return input.amountCents === 3000 ? "ok" : "review";
    }),
  };
  return { deps, events, settled, row };
}

function webhook(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    invoice_slug: "abc123",
    amount: 3000,
    paid_amount: 3000,
    installments: 1,
    capture_method: "pix",
    transaction_nsu: "9d6e7c1a-0000-4000-8000-000000000001",
    order_nsu: ORDER_ID,
    receipt_url: "https://recibo.infinitepay.io/abc123",
    items: [],
    ...overrides,
  });
}

describe("webhook", () => {
  it("confirms by payment_check, then marks the order paid", async () => {
    const { deps, events, settled } = setup();
    const result = await handleWebhook(webhook(), deps, TIMEOUT);

    expect(result).toEqual({ status: 200, outcome: "paid" });
    expect(deps.check).toHaveBeenCalledWith(
      { handle: "cake-zsf", apiKey: "inchk_test" },
      { orderNsu: ORDER_ID, transactionNsu: "9d6e7c1a-0000-4000-8000-000000000001", slug: "abc123" },
      TIMEOUT,
    );
    expect(settled).toHaveLength(1);
    expect(settled[0]).toMatchObject({ amountCents: 3000, captureMethod: "pix", receiptUrl: "https://recibo.infinitepay.io/abc123" });
    expect(events.map((e) => e.kind)).toEqual(["received", "settled_ok"]);
  });

  it("is idempotent: a repeated webhook answers 200 and changes nothing", async () => {
    const { deps, settled } = setup();
    await handleWebhook(webhook(), deps, TIMEOUT);
    const again = await handleWebhook(webhook(), deps, TIMEOUT);

    expect(again).toEqual({ status: 200, outcome: "duplicate" });
    expect(settled).toHaveLength(1);
    expect(deps.check).toHaveBeenCalledTimes(1);
  });

  it("refuses when payment_check says paid: false (400, nothing stored)", async () => {
    const { deps, events } = setup({ ...paid, paid: false });
    const result = await handleWebhook(webhook(), deps, TIMEOUT);

    expect(result).toEqual({ status: 400, outcome: "not_paid" });
    expect(deps.settle).not.toHaveBeenCalled();
    expect(events.map((e) => e.kind)).toEqual(["received", "not_paid"]);
  });

  it("answers 400 when payment_check fails or times out, so InfinitePay retries", async () => {
    const { deps } = setup({ ok: false, error: "timeout", raw: null });
    expect(await handleWebhook(webhook(), deps, TIMEOUT)).toEqual({ status: 400, outcome: "check_failed" });
    expect(deps.settle).not.toHaveBeenCalled();
  });

  it("uses the amount from payment_check, never the one in the webhook", async () => {
    const { deps, settled } = setup({ ...paid, amountCents: 100, paidAmountCents: 100 });
    const result = await handleWebhook(webhook({ amount: 3000, paid_amount: 3000 }), deps, TIMEOUT);

    expect(settled[0].amountCents).toBe(100);
    expect(result).toEqual({ status: 200, outcome: "review" });
  });

  it("answers 400 while the store's key is missing on the server", async () => {
    const { deps } = setup(paid, { payment_handle: "outra-loja" });
    expect(await handleWebhook(webhook(), deps, TIMEOUT)).toEqual({ status: 400, outcome: "no_account" });
    expect(deps.check).not.toHaveBeenCalled();
  });

  it("ignores an order that does not exist (200, nothing to retry)", async () => {
    const { deps } = setup(paid, null);
    expect(await handleWebhook(webhook(), deps, TIMEOUT)).toEqual({ status: 200, outcome: "ignore" });
    expect(await handleWebhook(webhook({ order_nsu: "pedido-123" }), deps, TIMEOUT)).toEqual({ status: 200, outcome: "ignore" });
    expect(deps.check).not.toHaveBeenCalled();
  });

  it("logs and refuses a body it cannot read", async () => {
    const { deps, events } = setup();
    expect(await handleWebhook("not json", deps, TIMEOUT)).toEqual({ status: 400, outcome: "invalid" });
    expect(await handleWebhook(webhook({ transaction_nsu: "" }), deps, TIMEOUT)).toEqual({ status: 400, outcome: "invalid" });
    expect(events.map((e) => e.kind)).toEqual(["invalid", "invalid"]);
    expect(deps.check).not.toHaveBeenCalled();
  });

  it("does not process when the raw log cannot be written", async () => {
    const { deps } = setup();
    deps.record = vi.fn(async () => {
      throw new Error("db down");
    });
    expect(await handleWebhook(webhook(), deps, TIMEOUT)).toEqual({ status: 400, outcome: "error" });
    expect(deps.settle).not.toHaveBeenCalled();
  });

  it("answers 400 when the database fails while settling", async () => {
    const { deps } = setup();
    deps.settle = vi.fn(async () => {
      throw new Error("db down");
    });
    expect(await handleWebhook(webhook(), deps, TIMEOUT)).toEqual({ status: 400, outcome: "error" });
  });
});

describe("customer return", () => {
  it("goes through the same confirmation", async () => {
    const { deps } = setup();
    const outcome = await confirmTransaction(
      { source: "return", orderId: ORDER_ID, transactionNsu: "t-1", invoiceSlug: "abc123", receiptUrl: "javascript:alert(1)", timeoutMs: 5000 },
      deps,
    );
    expect(outcome).toBe("paid");
    expect((deps.settle as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ receiptUrl: null });
  });
});

describe("helpers", () => {
  it("retries only what can work later", () => {
    expect(webhookStatus("paid")).toBe(200);
    expect(webhookStatus("duplicate")).toBe(200);
    expect(webhookStatus("review")).toBe(200);
    expect(webhookStatus("ignore")).toBe(200);
    expect(webhookStatus("not_paid")).toBe(400);
    expect(webhookStatus("check_failed")).toBe(400);
    expect(webhookStatus("no_account")).toBe(400);
  });

  it("keeps only https receipts", () => {
    expect(safeReceipt("https://recibo.infinitepay.io/1")).toBe("https://recibo.infinitepay.io/1");
    expect(safeReceipt("http://recibo.example/1")).toBeNull();
    expect(safeReceipt("javascript:alert(1)")).toBeNull();
    expect(safeReceipt(null)).toBeNull();
  });
});
