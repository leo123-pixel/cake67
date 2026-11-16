import "server-only";
// Server side of the InfinitePay payment (spec 12): opens links for the public
// site, confirms webhooks and returns. Uses the service role (rule 4): orders
// and payment_events are not readable by anon, and the payment functions are
// granted to service_role only.
import type { Json } from "@/lib/database.types";
import { siteUrl } from "@/lib/env";
import {
  buildLinkItems,
  checkPayment,
  createPaymentLink,
  readAccount,
  RETURN_CHECK_TIMEOUT_MS,
  type OrderLine,
} from "@/lib/infinitepay";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatKg } from "@/lib/weight";
import { paymentMode } from "./mode";
import {
  confirmTransaction,
  returnSchema,
  type ConfirmDeps,
  type ConfirmOutcome,
  type PaymentEvent,
  type SettleAction,
} from "./confirm";

type Admin = ReturnType<typeof createAdminClient>;

const CODE = /^C67-\d{6}$/;
const TOKEN = /^[0-9a-f]{32}$/;

// Whether a store can take online payments now: mode on, InfiniteTag set and
// its API key on the server. Never sends the key anywhere.
export function onlinePaymentReady(handle: string | null | undefined): boolean {
  return paymentMode() === "infinitepay" && readAccount(handle) !== null;
}

function asJson(value: unknown): Json {
  return (value === undefined ? null : JSON.parse(JSON.stringify(value))) as Json;
}

async function recordEvent(supabase: Admin, event: PaymentEvent): Promise<void> {
  const row = {
    source: event.source,
    kind: event.kind.slice(0, 40),
    order_id: event.orderId ?? null,
    transaction_nsu: event.transactionNsu?.slice(0, 120) ?? null,
    payload: asJson(event.payload ?? {}),
  };
  let { error } = await supabase.from("payment_events").insert(row);
  // order_nsu that is not one of our orders: keep the log without the link.
  if (error?.code === "23503") ({ error } = await supabase.from("payment_events").insert({ ...row, order_id: null }));
  if (error) throw new Error(`Could not record payment event: ${error.message}`);
}

export function confirmDeps(supabase: Admin = createAdminClient()): ConfirmDeps {
  return {
    record: (event) => recordEvent(supabase, event),
    findOrder: async (orderId) => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, payment_handle, transaction_nsu")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw new Error(`Could not load order: ${error.message}`);
      return data;
    },
    account: (handle) => readAccount(handle),
    check: (account, request, timeoutMs) => checkPayment(account, request, { timeoutMs }),
    settle: async (input) => {
      const { data, error } = await supabase.rpc("settle_online_payment", {
        p_order_id: input.orderId,
        p_transaction_nsu: input.transactionNsu,
        p_invoice_slug: input.invoiceSlug,
        p_amount_cents: input.amountCents,
        p_paid_amount_cents: input.paidAmountCents,
        p_installments: input.installments,
        p_capture_method: input.captureMethod,
        p_receipt_url: input.receiptUrl,
      });
      if (error) throw new Error(`settle_online_payment: ${error.code} ${error.message}`);
      return (data as { action: SettleAction }).action;
    },
  };
}

// --- opening a link -------------------------------------------------------------

export type StartResult =
  | { ok: true; url: string }
  | { ok: false; reason: "whatsapp" | "paid" | "not_found" | "failed"; message: string };

const WHATSAPP = "Este pedido é finalizado pelo WhatsApp.";
const FAILED = "Não conseguimos abrir o pagamento agora. Tente de novo ou finalize pelo WhatsApp.";

const REFUSALS: Record<string, StartResult> = {
  P0002: { ok: false, reason: "not_found", message: "Pedido não encontrado." },
  CK041: { ok: false, reason: "paid", message: "Este pedido já foi pago." },
  CK040: { ok: false, reason: "whatsapp", message: "Este pedido não pode mais ser pago pelo site." },
  CK042: { ok: false, reason: "whatsapp", message: WHATSAPP },
  CK043: { ok: false, reason: "whatsapp", message: "Limite de tentativas de pagamento. Finalize pelo WhatsApp." },
  CK044: { ok: false, reason: "whatsapp", message: "Encomendas são finalizadas pelo WhatsApp." },
  CK045: { ok: false, reason: "whatsapp", message: "A taxa de entrega será combinada no WhatsApp." },
};

type BeginRow = {
  order_id: string;
  code: string;
  handle: string;
  amount_cents: number;
  valid_until: string;
  checkout_url: string | null;
  customer_name: string;
  customer_whatsapp: string;
  delivery_fee_cents: number | null;
  items: { name: string; type: string; qty: number; unit_price_cents: number; total_cents: number; options: { weight_g?: number } | null }[];
};

function lineDescription(item: BeginRow["items"][number]): string {
  const weight = item.options?.weight_g;
  return item.type === "vitrine_kg" && weight ? `${item.name} ${formatKg(weight)}` : item.name;
}

// The customer comes back here (code + token in the path: InfinitePay appends
// its own query params to the redirect_url).
export function returnUrl(code: string, token: string): string {
  return `${siteUrl()}/api/pagamento/retorno/${encodeURIComponent(code)}/${token}`;
}

export function webhookUrl(): string {
  return `${siteUrl()}/api/webhooks/infinitepay`;
}

export async function startCheckout(code: string, token: string): Promise<StartResult> {
  if (!CODE.test(code) || !TOKEN.test(token)) return REFUSALS.P0002;
  if (paymentMode() !== "infinitepay") return { ok: false, reason: "whatsapp", message: WHATSAPP };

  const supabase = createAdminClient();
  const { data: owner, error: ownerError } = await supabase
    .from("orders")
    .select("store:stores(payment_handle)")
    .eq("code", code)
    .eq("public_token", token)
    .maybeSingle();
  if (ownerError) {
    console.error(`checkout: ${ownerError.message}`);
    return { ok: false, reason: "failed", message: FAILED };
  }
  if (!owner) return REFUSALS.P0002;
  if (!readAccount(owner.store?.payment_handle)) return { ok: false, reason: "whatsapp", message: WHATSAPP };

  const { data, error } = await supabase.rpc("begin_online_payment", { p_code: code, p_token: token });
  if (error) {
    const refusal = REFUSALS[error.code ?? ""];
    if (refusal) return refusal;
    console.error(`begin_online_payment: ${error.code} ${error.message}`);
    return { ok: false, reason: "failed", message: FAILED };
  }
  const begin = data as BeginRow;
  if (begin.checkout_url) return { ok: true, url: begin.checkout_url };

  const account = readAccount(begin.handle);
  if (!account) return { ok: false, reason: "whatsapp", message: WHATSAPP };

  const lines: OrderLine[] = begin.items.map((item) => ({
    description: lineDescription(item),
    qty: item.qty,
    unit_price_cents: item.unit_price_cents,
    total_cents: item.total_cents,
  }));
  const request = {
    orderNsu: begin.order_id,
    items: buildLinkItems(begin.code, lines, begin.delivery_fee_cents, begin.amount_cents),
    redirectUrl: returnUrl(code, token),
    webhookUrl: webhookUrl(),
    validUntil: new Date(begin.valid_until).toISOString(),
    customer: { name: begin.customer_name, whatsapp: begin.customer_whatsapp },
  };
  const link = await createPaymentLink(account, request);

  // The answer of /links is not documented: keep it whole (spec 12, D8).
  console.info(`infinitepay /links ${begin.code}: ${JSON.stringify(link.raw)?.slice(0, 2000)}`);
  await recordEvent(supabase, {
    source: "checkout",
    kind: link.ok ? "link_created" : "link_failed",
    orderId: begin.order_id,
    payload: { request: { ...request, customer: undefined }, answer: link.raw, error: link.ok ? null : link.error },
  }).catch((recordError: unknown) => console.error(recordError));

  if (!link.ok) {
    console.error(`infinitepay /links ${begin.code}: ${link.error}`);
    return { ok: false, reason: "failed", message: FAILED };
  }

  const { data: attached, error: attachError } = await supabase.rpc("attach_payment_link", {
    p_order_id: begin.order_id,
    p_valid_until: begin.valid_until,
    p_checkout_url: link.url,
    p_invoice_slug: link.slug,
  });
  if (attachError || !attached) {
    console.error(`attach_payment_link ${begin.code}: ${attachError?.message ?? "order moved on"}`);
    return { ok: false, reason: "failed", message: FAILED };
  }
  return { ok: true, url: link.url };
}

// --- customer return ------------------------------------------------------------

// Fallback for a late webhook: the query params are only used to ask
// payment_check, for the order that the code + token point to.
export async function confirmFromReturn(
  code: string,
  token: string,
  params: Record<string, string | undefined>,
): Promise<ConfirmOutcome | "skipped"> {
  if (!CODE.test(code) || !TOKEN.test(token)) return "skipped";
  const parsed = returnSchema.safeParse(params);
  if (!parsed.success) return "skipped";

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("code", code)
    .eq("public_token", token)
    .maybeSingle();
  if (!order) return "skipped";

  const deps = confirmDeps(supabase);
  await deps.record({
    source: "return",
    kind: "received",
    orderId: order.id,
    transactionNsu: parsed.data.transaction_nsu,
    payload: params,
  });
  return confirmTransaction(
    {
      source: "return",
      orderId: order.id,
      transactionNsu: parsed.data.transaction_nsu,
      invoiceSlug: parsed.data.slug,
      receiptUrl: parsed.data.receipt_url ?? null,
      timeoutMs: RETURN_CHECK_TIMEOUT_MS,
    },
    deps,
  );
}
