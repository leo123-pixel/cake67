import { describe, expect, it } from "vitest";
import { localInputToIso } from "@/lib/datetime";
import { NOTIFY_STATUSES, publicStatus, STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import {
  CONFIRMATION_TEMPLATE,
  describeConfirmedFulfillment,
  renderConfirmationMessage,
  templateProblems,
  type ConfirmationOrder,
} from "@/lib/whatsapp";

const DEFAULT_TEMPLATE =
  "Olá, {nome}! Seu pedido *{codigo}* foi confirmado pela Cake 67.\n{entrega}\nLoja: {loja}\n\nAcompanhe aqui: {link}";
const LINK = "https://cake67.vercel.app/pedido/C67-000123?t=abc";

const order: ConfirmationOrder = {
  code: "C67-000123",
  customer_name: "Carla",
  fulfillment: "retirada",
  scheduled_for: null,
  store: { name: "Loja 2", address: "Av. Afonso Pena, 2716" },
};

describe("confirmation message", () => {
  it("the default template (migration) has no problems", () => {
    expect(templateProblems(DEFAULT_TEMPLATE, CONFIRMATION_TEMPLATE)).toEqual({ missing: [], unknown: [] });
  });

  it("requires {codigo} and {link} and refuses order-only variables", () => {
    expect(templateProblems("Olá {nome} {itens}", CONFIRMATION_TEMPLATE)).toEqual({
      missing: ["codigo", "link"],
      unknown: ["itens"],
    });
  });

  it("renders the order without amounts", () => {
    expect(renderConfirmationMessage(DEFAULT_TEMPLATE, order, LINK)).toBe(
      `Olá, Carla! Seu pedido *C67-000123* foi confirmado pela Cake 67.\nRetirada na loja\nLoja: Loja 2 · Av. Afonso Pena, 2716\n\nAcompanhe aqui: ${LINK}`,
    );
  });
});

describe("describeConfirmedFulfillment", () => {
  const scheduled = localInputToIso("2026-10-04T15:00");

  it("vitrine pickup without a date has no reservation window", () => {
    expect(describeConfirmedFulfillment({ fulfillment: "retirada", scheduled_for: null })).toBe("Retirada na loja");
  });

  it("shows the scheduled date and time", () => {
    expect(describeConfirmedFulfillment({ fulfillment: "retirada", scheduled_for: scheduled })).toBe("Retirada em 04/10 às 15h");
    expect(describeConfirmedFulfillment({ fulfillment: "entrega", scheduled_for: scheduled })).toBe("Entrega em 04/10 às 15h");
  });

  it("delivery without a date", () => {
    expect(describeConfirmedFulfillment({ fulfillment: "entrega", scheduled_for: null })).toBe("Entrega");
  });
});

describe("publicStatus", () => {
  const statuses = Object.keys(STATUS_LABELS) as OrderStatus[];

  it.each(statuses)("%s has a title and a text for pickup and delivery", (status) => {
    for (const fulfillment of ["retirada", "entrega"] as const) {
      const { title, text } = publicStatus(status, fulfillment);
      expect(title.length).toBeGreaterThan(0);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("ready depends on pickup or delivery", () => {
    expect(publicStatus("pronto", "retirada").title).toBe("Pronto para retirar");
    expect(publicStatus("pronto", "entrega").title).toBe("Pronto para entrega");
  });

  it("confirmed tells the customer the store confirmed", () => {
    expect(publicStatus("confirmado", "retirada").title).toBe("Pedido confirmado");
  });

  it("the notice is offered only after confirmation", () => {
    expect(NOTIFY_STATUSES).toEqual(["confirmado", "em_producao", "pronto", "entregue"]);
  });
});
