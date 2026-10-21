import { describe, expect, it } from "vitest";
import { parseReturn, paymentView, type PublicPayment } from "@/lib/payments/public";

const payment = (overrides: Partial<PublicPayment> = {}): PublicPayment => ({
  status: "nenhum",
  method: null,
  attempts_left: 5,
  store_has_account: true,
  ...overrides,
});

describe("parseReturn", () => {
  it.each([
    ["ok", "ok"],
    ["cancelado", "cancelado"],
    ["erro", "erro"],
    ["x", null],
    [undefined, null],
    [["ok"], null],
  ])("%j -> %j", (value, expected) => {
    expect(parseReturn(value as string | string[] | undefined)).toBe(expected);
  });
});

describe("paymentView", () => {
  it("offers to pay a new order of a store with an account", () => {
    const view = paymentView("novo", payment(), null);
    expect(view).toMatchObject({ canPay: true, paid: false, badge: null, notice: null, poll: false });
    expect(view.statusText).toContain("pague pelo site");
  });

  it("keeps the WhatsApp-only page for stores without an account or orders out of attempts", () => {
    expect(paymentView("novo", payment({ store_has_account: false }), null)).toMatchObject({ canPay: false, statusText: null });
    expect(paymentView("novo", payment({ attempts_left: 0 }), null).canPay).toBe(false);
    expect(paymentView("novo", undefined, null)).toMatchObject({ canPay: false, statusText: null, badge: null });
  });

  it("only new orders take a payment", () => {
    for (const status of ["confirmado", "cancelado", "expirado", "entregue"] as const) {
      expect(paymentView(status, payment(), null).canPay).toBe(false);
    }
  });

  it("waits for the confirmation after coming back from Stripe", () => {
    const view = paymentView("novo", payment({ status: "pagando" }), "ok");
    expect(view).toMatchObject({ poll: true, notice: { text: "Confirmando o pagamento…", tone: "info" } });
  });

  it("shows a paid order with its method and stops polling", () => {
    const view = paymentView("novo", payment({ status: "pago", method: "pix" }), "ok");
    expect(view).toMatchObject({ paid: true, canPay: false, poll: false, badge: "Pago pelo site · Pix" });
    expect(view.statusText).toContain("Pagamento recebido");
    expect(view.notice?.text).toBe("Pagamento recebido. Obrigado!");
    expect(paymentView("confirmado", payment({ status: "pago", method: "card" }), null).badge).toBe("Pago pelo site · Cartão");
  });

  it("explains a cancelled or failed opening", () => {
    expect(paymentView("novo", payment(), "cancelado").notice?.tone).toBe("error");
    expect(paymentView("novo", payment(), "erro").notice?.text).toContain("Não conseguimos abrir o pagamento");
    expect(paymentView("novo", payment({ status: "pago" }), "erro").notice).toBeNull();
  });

  it.each([
    ["devolvendo", "Devolução do pagamento em andamento"],
    ["falha_devolucao", "Devolução do pagamento em andamento"],
    ["devolvido", "Pagamento devolvido"],
    ["conferir", "Pagamento em conferência"],
  ] as const)("names a %s payment", (status, badge) => {
    expect(paymentView("cancelado", payment({ status }), null).badge).toBe(badge);
  });

  it("tells the customer when a payment needs checking", () => {
    expect(paymentView("novo", payment({ status: "conferir" }), null)).toMatchObject({ canPay: false });
    expect(paymentView("novo", payment({ status: "conferir" }), null).statusText).toContain("conferir");
  });
});
