// InfinitePay Checkout Integrado (https://www.infinitepay.io/checkout-documentacao).
// Two endpoints: POST /links creates a payment link, POST /payment_check says
// whether a transaction was paid. The webhook is not signed, so a payment only
// counts after /payment_check confirms it (spec 12, D6).
//
// Each store is its own CNPJ and its own InfinitePay account: every call takes
// the account (handle + API key) as a parameter. This file has no secrets of
// its own and no "server-only" import so the pure helpers can be unit tested;
// keys are read from the env only on the server (lib/payments/server.ts).

export const INFINITEPAY_API = "https://api.checkout.infinitepay.io";

// The webhook must answer in under 1 s, so its payment_check has a short leash;
// a timeout answers 400 and InfinitePay sends the webhook again.
export const WEBHOOK_CHECK_TIMEOUT_MS = 700;
export const RETURN_CHECK_TIMEOUT_MS = 5000;
export const LINK_TIMEOUT_MS = 8000;

// InfinitePay minimum for any payment, Pix included: R$ 1,00.
export const MIN_AMOUNT_CENTS = 100;
// How long a link can be paid (spec 12, D5).
export const LINK_MINUTES = 60;

export type InfinitePayAccount = { handle: string; apiKey: string };

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;
type CallOptions = { fetch?: Fetch; timeoutMs?: number };

// Reais (number, possibly with float noise like 15.000000001) to cents.
export function toCents(reais: number): number {
  if (!Number.isFinite(reais)) throw new Error(`Invalid amount: ${reais}`);
  return Math.round(reais * 100);
}

export function isHandle(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9_.-]{1,39}$/.test(value);
}

// INFINITEPAY_API_KEY_<HANDLE> (handle in upper case, other characters as _),
// e.g. INFINITEPAY_API_KEY_CAKE_ZSF. For a single account, INFINITEPAY_HANDLE +
// INFINITEPAY_API_KEY also work.
export function apiKeyVariable(handle: string): string {
  return `INFINITEPAY_API_KEY_${handle.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

export function readAccount(handle: string | null | undefined, env: Env = process.env): InfinitePayAccount | null {
  if (!isHandle(handle)) return null;
  const own = env[apiKeyVariable(handle)]?.trim();
  const single = env.INFINITEPAY_HANDLE?.trim() === handle ? env.INFINITEPAY_API_KEY?.trim() : undefined;
  const apiKey = own || single;
  return apiKey ? { handle, apiKey } : null;
}

// --- link ---------------------------------------------------------------------

export type LinkItem = { description: string; quantity: number; price: number };

export type OrderLine = { description: string; qty: number; unit_price_cents: number; total_cents: number };

const DESCRIPTION_MAX = 100;

function clip(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > DESCRIPTION_MAX ? `${clean.slice(0, DESCRIPTION_MAX - 1)}…` : clean;
}

// Items shown on the InfinitePay page. Prices come from the order lines stored
// by create_order; when a line's total is not qty × unit (or the sum does not
// close with the charged amount), the link carries one line with the total,
// so the amount charged is always the order's.
export function buildLinkItems(
  code: string,
  lines: OrderLine[],
  deliveryFeeCents: number | null,
  amountCents: number,
): LinkItem[] {
  const items: LinkItem[] = lines.map((line) =>
    line.qty > 0 && line.qty * line.unit_price_cents === line.total_cents && line.unit_price_cents > 0
      ? { description: clip(line.description), quantity: line.qty, price: line.unit_price_cents }
      : { description: clip(`${line.qty}x ${line.description}`), quantity: 1, price: line.total_cents },
  );
  if (deliveryFeeCents) items.push({ description: "Entrega (Juma)", quantity: 1, price: deliveryFeeCents });

  const sum = items.reduce((total, item) => total + item.quantity * item.price, 0);
  const valid = items.length > 0 && items.every((item) => Number.isInteger(item.price) && item.price > 0);
  if (sum === amountCents && valid) return items;
  return [{ description: clip(`Pedido ${code} · Cake 67`), quantity: 1, price: amountCents }];
}

// "5567999887766" -> "+5567999887766" (the order stores digits with 55).
export function toPhoneNumber(whatsapp: string): string | undefined {
  const digits = whatsapp.replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(digits)) return `+${digits}`;
  if (/^\d{10,11}$/.test(digits)) return `+55${digits}`;
  return undefined;
}

export type LinkRequest = {
  orderNsu: string;
  items: LinkItem[];
  redirectUrl: string;
  webhookUrl: string;
  validUntil: string;
  customer: { name: string; whatsapp: string };
};

// Body of POST /links. Options need the API key (single_payment, valid_until,
// payment_methods_enabled, assured_installments). Installments cannot be
// limited by the API (spec 12, D7): assured_installments 0 passes the fees of
// every installment to the customer, so the store receives the full amount.
export function linkBody(account: InfinitePayAccount, request: LinkRequest) {
  const phone = toPhoneNumber(request.customer.whatsapp);
  return {
    handle: account.handle,
    order_nsu: request.orderNsu,
    items: request.items,
    redirect_url: request.redirectUrl,
    webhook_url: request.webhookUrl,
    customer: { name: request.customer.name.slice(0, 80), ...(phone ? { phone_number: phone } : {}) },
    options: {
      single_payment: true,
      valid_until: request.validUntil,
      payment_methods_enabled: ["credit_card", "pix"],
      assured_installments: 0,
      require_delivery_address: false,
    },
  };
}

export type LinkResult =
  | { ok: true; url: string; slug: string | null; raw: unknown }
  | { ok: false; error: string; status: number | null; raw: unknown };

function pick(source: unknown, keys: string[]): string | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

// The answer of /links is not documented: look for the URL under the usual
// names, at the top level or inside "data"/"link".
export function parseLinkResponse(body: unknown): { url: string; slug: string | null } | null {
  const holders = [body, (body as { data?: unknown } | null)?.data, (body as { link?: unknown } | null)?.link];
  for (const holder of holders) {
    const url = pick(holder, ["url", "link", "checkout_url", "payment_url", "link_url"]);
    if (url && /^https:\/\//.test(url)) {
      return { url, slug: pick(holder, ["slug", "invoice_slug", "invoice", "code"]) };
    }
  }
  return null;
}

function headers(account: InfinitePayAccount): Record<string, string> {
  return { "Content-Type": "application/json", Accept: "application/json", "X-Api-Key": account.apiKey };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 500);
  }
}

function describeFailure(error: unknown): string {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  return error instanceof Error ? error.message.slice(0, 200) : "network error";
}

export async function createPaymentLink(
  account: InfinitePayAccount,
  request: LinkRequest,
  options: CallOptions = {},
): Promise<LinkResult> {
  const doFetch = options.fetch ?? fetch;
  try {
    const response = await doFetch(`${INFINITEPAY_API}/links`, {
      method: "POST",
      headers: headers(account),
      body: JSON.stringify(linkBody(account, request)),
      signal: AbortSignal.timeout(options.timeoutMs ?? LINK_TIMEOUT_MS),
      cache: "no-store",
    });
    const raw = await readBody(response);
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}`, status: response.status, raw };
    const link = parseLinkResponse(raw);
    if (!link) return { ok: false, error: "no checkout url in the answer", status: response.status, raw };
    return { ok: true, url: link.url, slug: link.slug, raw };
  } catch (error) {
    return { ok: false, error: describeFailure(error), status: null, raw: null };
  }
}

// --- payment_check --------------------------------------------------------------

export type CheckRequest = { orderNsu: string; transactionNsu: string; slug: string };

export type CheckResult =
  | {
      ok: true;
      paid: boolean;
      amountCents: number | null;
      paidAmountCents: number | null;
      installments: number | null;
      captureMethod: "credit_card" | "pix" | null;
      raw: unknown;
    }
  | { ok: false; error: string; raw: unknown };

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

// { success, paid, amount, paid_amount, installments, capture_method }. Anything
// that is not success && paid === true counts as not paid.
export function parseCheckResponse(body: unknown): CheckResult {
  if (!body || typeof body !== "object") return { ok: false, error: "unexpected answer", raw: body };
  const data = body as Record<string, unknown>;
  const method = data.capture_method === "credit_card" || data.capture_method === "pix" ? data.capture_method : null;
  return {
    ok: true,
    paid: data.success === true && data.paid === true,
    amountCents: int(data.amount),
    paidAmountCents: int(data.paid_amount),
    installments: int(data.installments),
    captureMethod: method,
    raw: body,
  };
}

export async function checkPayment(
  account: InfinitePayAccount,
  request: CheckRequest,
  options: CallOptions = {},
): Promise<CheckResult> {
  const doFetch = options.fetch ?? fetch;
  try {
    const response = await doFetch(`${INFINITEPAY_API}/payment_check`, {
      method: "POST",
      headers: headers(account),
      body: JSON.stringify({
        handle: account.handle,
        order_nsu: request.orderNsu,
        transaction_nsu: request.transactionNsu,
        slug: request.slug,
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? RETURN_CHECK_TIMEOUT_MS),
      cache: "no-store",
    });
    const raw = await readBody(response);
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}`, raw };
    return parseCheckResponse(raw);
  } catch (error) {
    return { ok: false, error: describeFailure(error), raw: null };
  }
}
