// What happens when InfinitePay says a transaction exists (webhook) or the
// customer comes back from the checkout (redirect). Neither is trusted: the
// transaction only counts after /payment_check says paid, and the database
// (settle_online_payment) checks the amount against the order and ignores a
// transaction it has already handled (spec 12, D6).
//
// Dependencies are injected so the rules are unit tested without a database or
// the network; lib/payments/server.ts wires the real ones.
import { z } from "zod";
import type { CheckRequest, CheckResult, InfinitePayAccount } from "@/lib/infinitepay";

export type PaymentSource = "webhook" | "return";

export type PaymentEvent = {
  source: PaymentSource | "checkout";
  kind: string;
  orderId?: string | null;
  transactionNsu?: string | null;
  payload?: unknown;
};

export type OrderForPayment = {
  id: string;
  payment_handle: string | null;
  transaction_nsu: string | null;
};

export type SettleInput = {
  orderId: string;
  transactionNsu: string;
  invoiceSlug: string;
  amountCents: number;
  paidAmountCents: number | null;
  installments: number | null;
  captureMethod: "credit_card" | "pix" | null;
  receiptUrl: string | null;
};

export type SettleAction = "ok" | "duplicate" | "review" | "ignore";

export type ConfirmDeps = {
  record: (event: PaymentEvent) => Promise<void>;
  findOrder: (orderId: string) => Promise<OrderForPayment | null>;
  account: (handle: string | null) => InfinitePayAccount | null;
  check: (account: InfinitePayAccount, request: CheckRequest, timeoutMs: number) => Promise<CheckResult>;
  settle: (input: SettleInput) => Promise<SettleAction>;
};

export type ConfirmInput = {
  source: PaymentSource;
  orderId: string;
  transactionNsu: string;
  invoiceSlug: string;
  receiptUrl: string | null;
  timeoutMs: number;
};

export type ConfirmOutcome =
  | "paid"         // confirmed and stored
  | "duplicate"    // this transaction was already handled
  | "review"       // paid, but it does not fit the order: the panel shows "Conferir"
  | "ignore"       // no such order, or the transaction belongs to another order
  | "not_paid"     // payment_check says it is not paid (yet)
  | "check_failed" // payment_check did not answer (timeout, HTTP error)
  | "no_account";  // the order's account has no key on the server

// 200 tells InfinitePay to stop; 400 makes it send the webhook again. Only
// what may succeed later is retried.
export function webhookStatus(outcome: ConfirmOutcome): 200 | 400 {
  return outcome === "not_paid" || outcome === "check_failed" || outcome === "no_account" ? 400 : 200;
}

const text = (max: number) => z.string().trim().min(1).max(max);

// Fields we use from the webhook; the rest only goes to the log.
export const webhookSchema = z.object({
  order_nsu: text(120),
  transaction_nsu: text(120),
  invoice_slug: text(120),
  receipt_url: z.string().max(500).optional().nullable(),
});

// Query params of the redirect_url (same names, but "slug").
export const returnSchema = z.object({
  order_nsu: text(120).optional(),
  transaction_nsu: text(120),
  slug: text(120),
  receipt_url: z.string().max(500).optional().nullable(),
  capture_method: z.string().max(20).optional(),
});

export function safeReceipt(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

const isUuid = (value: string) => z.uuid().safeParse(value).success;

export async function confirmTransaction(input: ConfirmInput, deps: ConfirmDeps): Promise<ConfirmOutcome> {
  const base = { source: input.source, orderId: null, transactionNsu: input.transactionNsu } as const;

  if (!isUuid(input.orderId)) {
    await deps.record({ ...base, kind: "unknown_order", payload: { order_nsu: input.orderId } });
    return "ignore";
  }
  const order = await deps.findOrder(input.orderId);
  if (!order) {
    await deps.record({ ...base, kind: "unknown_order", payload: { order_nsu: input.orderId } });
    return "ignore";
  }
  const scoped = { ...base, orderId: order.id };

  // Repeated webhook: nothing to check or store again.
  if (order.transaction_nsu === input.transactionNsu) {
    await deps.record({ ...scoped, kind: "duplicate" });
    return "duplicate";
  }

  const account = deps.account(order.payment_handle);
  if (!account) {
    await deps.record({ ...scoped, kind: "no_account", payload: { handle: order.payment_handle } });
    return "no_account";
  }

  const check = await deps.check(
    account,
    { orderNsu: order.id, transactionNsu: input.transactionNsu, slug: input.invoiceSlug },
    input.timeoutMs,
  );
  if (!check.ok) {
    await deps.record({ ...scoped, kind: "check_failed", payload: { error: check.error, answer: check.raw } });
    return "check_failed";
  }
  if (!check.paid || check.amountCents === null) {
    await deps.record({ ...scoped, kind: "not_paid", payload: check.raw });
    return "not_paid";
  }

  const action = await deps.settle({
    orderId: order.id,
    transactionNsu: input.transactionNsu,
    invoiceSlug: input.invoiceSlug,
    amountCents: check.amountCents,
    paidAmountCents: check.paidAmountCents,
    installments: check.installments,
    captureMethod: check.captureMethod,
    receiptUrl: safeReceipt(input.receiptUrl),
  });
  await deps.record({ ...scoped, kind: `settled_${action}`, payload: check.raw });

  return action === "ok" ? "paid" : action;
}

// The webhook route: log the raw body first, then confirm. Any unexpected
// failure is a 400 so InfinitePay tries again.
export async function handleWebhook(
  rawBody: string,
  deps: ConfirmDeps,
  timeoutMs: number,
): Promise<{ status: 200 | 400; outcome: ConfirmOutcome | "invalid" | "error" }> {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    json = null;
  }
  const parsed = webhookSchema.safeParse(json);
  const nsu = parsed.success ? parsed.data.transaction_nsu : null;

  try {
    // The raw log is the audit trail: without it, do not process.
    await deps.record({
      source: "webhook",
      kind: parsed.success ? "received" : "invalid",
      orderId: parsed.success && isUuid(parsed.data.order_nsu) ? parsed.data.order_nsu : null,
      transactionNsu: nsu,
      payload: json ?? { body: rawBody.slice(0, 2000) },
    });
  } catch {
    return { status: 400, outcome: "error" };
  }
  if (!parsed.success) return { status: 400, outcome: "invalid" };

  try {
    const outcome = await confirmTransaction(
      {
        source: "webhook",
        orderId: parsed.data.order_nsu,
        transactionNsu: parsed.data.transaction_nsu,
        invoiceSlug: parsed.data.invoice_slug,
        receiptUrl: parsed.data.receipt_url ?? null,
        timeoutMs,
      },
      deps,
    );
    return { status: webhookStatus(outcome), outcome };
  } catch {
    return { status: 400, outcome: "error" };
  }
}
