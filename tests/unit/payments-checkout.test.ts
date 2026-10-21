import { describe, expect, it } from "vitest";
import { PIX_EXPIRES_SECONDS, checkoutParams, orderUrl } from "@/lib/payments/checkout-params";

const input = {
  paymentId: "3f1c2a9e-7a51-4f0e-9d0c-1b2c3d4e5f60",
  code: "C67-000123",
  token: "a1b2c3",
  amountCents: 27180,
  expiresAt: "2026-10-21T15:31:00.000Z",
  methods: ["card", "pix"] as ("card" | "pix")[],
  siteUrl: "https://www.cake67.com.br",
};

describe("checkoutParams", () => {
  const params = checkoutParams(input);

  it("charges the order total from the database in one line, in reais", () => {
    expect(params.mode).toBe("payment");
    expect(params.line_items).toEqual([
      { quantity: 1, price_data: { currency: "brl", unit_amount: 27180, product_data: { name: "Pedido C67-000123" } } },
    ]);
  });

  it("offers card and Pix, with a short Pix code", () => {
    expect(params.allowed_payment_method_types).toEqual(["card", "pix"]);
    expect(params.payment_method_options).toEqual({ pix: { expires_after_seconds: PIX_EXPIRES_SECONDS } });
    expect(PIX_EXPIRES_SECONDS).toBe(600);
  });

  it("leaves Pix options out when the account only takes cards", () => {
    const cardOnly = checkoutParams({ ...input, methods: ["card"] });
    expect(cardOnly.allowed_payment_method_types).toEqual(["card"]);
    expect(cardOnly.payment_method_options).toBeUndefined();
  });

  it("ends the session when the attempt ends, in seconds", () => {
    expect(params.expires_at).toBe(Date.parse("2026-10-21T15:31:00.000Z") / 1000);
    expect(Number.isInteger(params.expires_at)).toBe(true);
  });

  it("ties the session and the payment to the attempt", () => {
    expect(params.client_reference_id).toBe(input.paymentId);
    expect(params.metadata).toEqual({ payment_id: input.paymentId, order_code: "C67-000123" });
    expect(params.payment_intent_data).toEqual({ metadata: { payment_id: input.paymentId, order_code: "C67-000123" } });
  });

  it("returns to the order page in Portuguese", () => {
    expect(params.locale).toBe("pt-BR");
    expect(params.success_url).toBe("https://www.cake67.com.br/pedido/C67-000123?t=a1b2c3&pagamento=ok");
    expect(params.cancel_url).toBe("https://www.cake67.com.br/pedido/C67-000123?t=a1b2c3&pagamento=cancelado");
  });
});

describe("orderUrl", () => {
  it("builds the tracking link with or without the payment outcome", () => {
    expect(orderUrl("http://localhost:3000", "C67-000001", "tok")).toBe("http://localhost:3000/pedido/C67-000001?t=tok");
    expect(orderUrl("http://localhost:3000", "C67-000001", "tok", "erro")).toBe(
      "http://localhost:3000/pedido/C67-000001?t=tok&pagamento=erro",
    );
  });
});
