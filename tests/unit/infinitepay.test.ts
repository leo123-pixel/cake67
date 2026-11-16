import { describe, expect, it, vi } from "vitest";
import {
  apiKeyVariable,
  buildLinkItems,
  checkPayment,
  createPaymentLink,
  INFINITEPAY_API,
  linkBody,
  parseCheckResponse,
  parseLinkResponse,
  readAccount,
  toCents,
  toPhoneNumber,
  type InfinitePayAccount,
  type LinkRequest,
} from "@/lib/infinitepay";
import { describeMethod, describePaid } from "@/lib/payments/labels";
import { parsePaymentMode } from "@/lib/payments/mode";

const account: InfinitePayAccount = { handle: "cake-zsf", apiKey: "inchk_test" };

const request: LinkRequest = {
  orderNsu: "6f1c2b9e-6a39-4b8a-9d0e-0f4d7f3f5a11",
  items: [{ description: "Bolo de Pote Ninho", quantity: 2, price: 1500 }],
  redirectUrl: "https://www.cake67.com.br/api/pagamento/retorno/C67-000123/abc",
  webhookUrl: "https://www.cake67.com.br/api/webhooks/infinitepay",
  validUntil: "2026-11-16T21:00:00.000Z",
  customer: { name: "João Silva", whatsapp: "5567999887766" },
};

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("toCents", () => {
  it("rounds reais to whole cents", () => {
    expect(toCents(15)).toBe(1500);
    expect(toCents(19.99)).toBe(1999); // 1998.9999999999998
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1)).toBe(100);
    expect(toCents(10.005)).toBe(1001);
  });

  it("refuses what is not a number", () => {
    expect(() => toCents(Number.NaN)).toThrow();
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("readAccount", () => {
  it("reads the key of each store's handle", () => {
    expect(apiKeyVariable("cake-zsf")).toBe("INFINITEPAY_API_KEY_CAKE_ZSF");
    expect(readAccount("cake-zsf", { INFINITEPAY_API_KEY_CAKE_ZSF: " inchk_a " })).toEqual({ handle: "cake-zsf", apiKey: "inchk_a" });
  });

  it("accepts the single-account variables for the same handle only", () => {
    const env = { INFINITEPAY_HANDLE: "cake-zsf", INFINITEPAY_API_KEY: "inchk_b" };
    expect(readAccount("cake-zsf", env)).toEqual({ handle: "cake-zsf", apiKey: "inchk_b" });
    expect(readAccount("outra-loja", env)).toBeNull();
  });

  it("is null without a valid handle or key", () => {
    expect(readAccount(null, { INFINITEPAY_API_KEY: "x" })).toBeNull();
    expect(readAccount("$cake", { INFINITEPAY_API_KEY_CAKE: "x" })).toBeNull();
    expect(readAccount("cake-zsf", {})).toBeNull();
  });
});

describe("buildLinkItems (total)", () => {
  const lines = [
    { description: "Bolo de Pote Ninho", qty: 2, unit_price_cents: 1500, total_cents: 3000 },
    { description: "Cookie", qty: 1, unit_price_cents: 900, total_cents: 900 },
  ];

  it("lists each line and the delivery, adding up to the charged amount", () => {
    const items = buildLinkItems("C67-000123", lines, 850, 4750);
    expect(items).toEqual([
      { description: "Bolo de Pote Ninho", quantity: 2, price: 1500 },
      { description: "Cookie", quantity: 1, price: 900 },
      { description: "Entrega (Juma)", quantity: 1, price: 850 },
    ]);
    expect(items.reduce((sum, item) => sum + item.quantity * item.price, 0)).toBe(4750);
  });

  it("uses the line total when it is not qty × unit", () => {
    const items = buildLinkItems("C67-000123", [{ description: "Bolo inteiro 1,2 kg", qty: 1, unit_price_cents: 0, total_cents: 13440 }], null, 13440);
    expect(items).toEqual([{ description: "1x Bolo inteiro 1,2 kg", quantity: 1, price: 13440 }]);
  });

  it("falls back to one line with the amount when the sum does not close", () => {
    expect(buildLinkItems("C67-000123", lines, null, 5000)).toEqual([
      { description: "Pedido C67-000123 · Cake 67", quantity: 1, price: 5000 },
    ]);
  });

  it("clips long descriptions", () => {
    const [item] = buildLinkItems("C67-000123", [{ description: "x".repeat(300), qty: 1, unit_price_cents: 100, total_cents: 100 }], null, 100);
    expect(item.description.length).toBeLessThanOrEqual(100);
  });
});

describe("link request", () => {
  it("formats the customer's phone", () => {
    expect(toPhoneNumber("5567999887766")).toBe("+5567999887766");
    expect(toPhoneNumber("67999887766")).toBe("+5567999887766");
    expect(toPhoneNumber("123")).toBeUndefined();
  });

  it("sends items (not itens), one payment, 60-minute expiry and no absorbed installments", () => {
    const body = linkBody(account, request);
    expect(body).toMatchObject({
      handle: "cake-zsf",
      order_nsu: request.orderNsu,
      items: request.items,
      redirect_url: request.redirectUrl,
      webhook_url: request.webhookUrl,
      customer: { name: "João Silva", phone_number: "+5567999887766" },
      options: {
        single_payment: true,
        valid_until: request.validUntil,
        payment_methods_enabled: ["credit_card", "pix"],
        assured_installments: 0,
        require_delivery_address: false,
      },
    });
    expect(body).not.toHaveProperty("itens");
  });

  it("reads the checkout url under the usual names", () => {
    expect(parseLinkResponse({ url: "https://checkout.infinitepay.io/cake-zsf/abc", slug: "abc" })).toEqual({
      url: "https://checkout.infinitepay.io/cake-zsf/abc",
      slug: "abc",
    });
    expect(parseLinkResponse({ link: "https://pay.example/x" })).toEqual({ url: "https://pay.example/x", slug: null });
    expect(parseLinkResponse({ checkout_url: "https://pay.example/y", invoice_slug: "y" })?.slug).toBe("y");
    expect(parseLinkResponse({ data: { url: "https://pay.example/z" } })?.url).toBe("https://pay.example/z");
    expect(parseLinkResponse({ url: "http://insecure.example" })).toBeNull();
    expect(parseLinkResponse("oops")).toBeNull();
  });
});

describe("createPaymentLink", () => {
  it("posts to /links with the API key only in the header", async () => {
    const doFetch = fakeFetch(200, { url: "https://checkout.infinitepay.io/cake-zsf/abc", slug: "abc" });
    const result = await createPaymentLink(account, request, { fetch: doFetch });
    expect(result).toMatchObject({ ok: true, url: "https://checkout.infinitepay.io/cake-zsf/abc", slug: "abc" });

    const [url, init] = (doFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${INFINITEPAY_API}/links`);
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("inchk_test");
    expect(String(init.body)).not.toContain("inchk_test");
  });

  it("reports HTTP errors and answers without a url, keeping the raw answer", async () => {
    expect(await createPaymentLink(account, request, { fetch: fakeFetch(403, { error: "forbidden" }) })).toMatchObject({
      ok: false,
      status: 403,
      raw: { error: "forbidden" },
    });
    expect(await createPaymentLink(account, request, { fetch: fakeFetch(200, { ok: true }) })).toMatchObject({
      ok: false,
      error: "no checkout url in the answer",
    });
  });

  it("turns a timeout into an error", async () => {
    const doFetch = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    }) as unknown as typeof fetch;
    expect(await createPaymentLink(account, request, { fetch: doFetch })).toMatchObject({ ok: false, error: "timeout" });
  });
});

describe("checkPayment", () => {
  it("only counts success and paid", () => {
    expect(parseCheckResponse({ success: true, paid: true, amount: 1500, paid_amount: 1510, installments: 2, capture_method: "credit_card" })).toMatchObject({
      ok: true,
      paid: true,
      amountCents: 1500,
      paidAmountCents: 1510,
      installments: 2,
      captureMethod: "credit_card",
    });
    expect(parseCheckResponse({ success: true, paid: false })).toMatchObject({ ok: true, paid: false });
    expect(parseCheckResponse({ success: false, paid: true })).toMatchObject({ ok: true, paid: false });
    expect(parseCheckResponse({ success: true, paid: "true" })).toMatchObject({ ok: true, paid: false });
    expect(parseCheckResponse(null)).toMatchObject({ ok: false });
  });

  it("sends handle, order, transaction and slug", async () => {
    const doFetch = fakeFetch(200, { success: true, paid: true, amount: 1500 });
    await checkPayment(account, { orderNsu: "o", transactionNsu: "t", slug: "s" }, { fetch: doFetch });
    const [url, init] = (doFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${INFINITEPAY_API}/payment_check`);
    expect(JSON.parse(String(init.body))).toEqual({ handle: "cake-zsf", order_nsu: "o", transaction_nsu: "t", slug: "s" });
  });

  it("is an error on HTTP failure", async () => {
    expect(await checkPayment(account, { orderNsu: "o", transactionNsu: "t", slug: "s" }, { fetch: fakeFetch(500, "") })).toMatchObject({
      ok: false,
      error: "HTTP 500",
    });
  });
});

describe("payment mode and labels", () => {
  it("is InfinitePay unless set to whatsapp", () => {
    expect(parsePaymentMode(undefined)).toBe("infinitepay");
    expect(parsePaymentMode("infinitepay")).toBe("infinitepay");
    expect(parsePaymentMode(" WhatsApp ")).toBe("whatsapp");
  });

  it("describes method and paid amount", () => {
    expect(describeMethod("pix", 1)).toBe("Pix");
    expect(describeMethod("credit_card", 1)).toBe("Cartão de crédito à vista");
    expect(describeMethod("credit_card", 3)).toBe("Cartão de crédito em 3x");
    expect(describePaid(1500, 1500)).toBe("R$ 15,00");
    expect(describePaid(1500, 1610)).toContain("juros do parcelamento");
  });
});
