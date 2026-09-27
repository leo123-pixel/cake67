import { describe, expect, it } from "vitest";
import { answerQuestion, type AssistantData } from "@/lib/assistant";
import { cakeWhatsappMessage, minCakeDate } from "@/lib/cake-order";
import { parseStoredCart } from "@/lib/cart/cart";
import { describeHours } from "@/lib/store-hours";

describe("describeHours", () => {
  it("groups days like the prototype (Loja 1)", () => {
    const hours = Object.fromEntries(
      ["mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, { open: "10:00", close: "19:00" }]).concat([["sun", { open: "09:00", close: "12:00" }]]),
    );
    expect(describeHours(hours)).toBe("Seg a sáb, 10h às 19h · Dom, 9h às 12h");
  });

  it("keeps minutes and omits closed days (Loja 2)", () => {
    const hours = {
      ...Object.fromEntries(["mon", "tue", "wed", "thu", "fri"].map((d) => [d, { open: "10:30", close: "18:00" }])),
      sat: { open: "10:00", close: "17:30" },
      sun: null,
    };
    expect(describeHours(hours)).toBe("Seg a sex, 10h30 às 18h · Sáb, 10h às 17h30");
  });

  it("two days use 'e' and an empty week is empty", () => {
    expect(describeHours({ sat: { open: "09:00", close: "12:00" }, sun: { open: "09:00", close: "12:00" } })).toBe("Sáb e dom, 9h às 12h");
    expect(describeHours(null)).toBe("");
  });
});

const data: AssistantData = {
  stores: [
    { name: "Loja 1", address: "Rua Estiva, 200", hours: "Seg a sáb, 10h às 19h · Dom, 9h às 12h" },
    { name: "Loja 2", address: "Av. Afonso Pena, 2716", hours: "Seg a sex, 10h30 às 18h" },
  ],
  vitrine: [
    {
      storeName: "Loja 1",
      items: [
        { name: "Fatia Karen", category: "Fatias", priceCents: 2200, available: true },
        { name: "Cheesecake", category: "Fatias", priceCents: 2700, available: false },
        { name: "Croissant Caprese", category: "Croissants", priceCents: 2290, available: true },
      ],
    },
    { storeName: "Loja 2", items: [{ name: "Crunch Cake", category: "Fatias", priceCents: 2490, available: true }] },
  ],
  cakes: [
    { name: "Bolo Ninho com Morango", priceCents: null, leadTimeHours: 48, weightsKg: [1, 1.5, 2, 2.5, 3, 3.5, 4], formats: ["Redondo", "Retangular"] },
  ],
};

describe("answerQuestion", () => {
  it("lists only available slices per store", () => {
    const answer = answerQuestion("Tem fatia hoje?", data);
    expect(answer.text).toContain("Loja 1: Fatia Karen (R$");
    expect(answer.text).toContain("Loja 2: Crunch Cake");
    expect(answer.text).not.toContain("Cheesecake");
    expect(answer.action?.target).toBe("vitrine");
  });

  it("suggests weight and format for N guests", () => {
    const answer = answerQuestion("Bolo para 30 pessoas", data);
    expect(answer.text).toContain("Para 30 pessoas sugiro 3,5 kg");
    expect(answer.action?.target).toBe("calc");
  });

  it("answers opening hours from the database", () => {
    const answer = answerQuestion("Abre domingo?", data);
    expect(answer.text).toContain("Dom, 9h às 12h");
    expect(answer.action?.target).toBe("lojas");
  });

  it("answers the real lead time", () => {
    expect(answerQuestion("Qual o prazo?", data).text).toContain("48 h de antecedência");
  });

  it("never invents a cake price", () => {
    const text = answerQuestion("Quanto custa o kg?", data).text;
    expect(text).toContain("em breve");
    expect(text).not.toMatch(/R\$/);
  });

  it("payment and delivery go to WhatsApp", () => {
    expect(answerQuestion("Aceita Pix?", data).text).toContain("WhatsApp");
    expect(answerQuestion("Vocês entregam?", data).text).toContain("WhatsApp");
  });

  it("croissants come from the vitrine", () => {
    expect(answerQuestion("tem croissant?", data).text).toContain("Croissant Caprese");
  });

  it("unknown questions offer WhatsApp with the question", () => {
    const answer = answerQuestion("Vocês fazem bolo vegano?", data);
    expect(answer.whatsappText).toBe("Olá, Cake 67! Vocês fazem bolo vegano?");
  });
});

describe("cake order helpers", () => {
  it("minimum date honors the lead time", () => {
    expect(minCakeDate("2026-09-27", 48)).toBe("2026-09-29");
    expect(minCakeDate("2026-09-30", 72)).toBe("2026-10-03");
  });

  it("WhatsApp text for a cake without price", () => {
    expect(
      cakeWhatsappMessage({
        name: "Bolo Ninho com Morango",
        weightKg: 2.5,
        format: "Retangular",
        addons: ["Velas"],
        fulfillment: "Retirada na Loja 1 · Rua Estiva, 200",
        date: "2026-10-02",
      }),
    ).toBe(
      "Olá, Cake 67! Quero encomendar um bolo:\nBolo Ninho com Morango · 2,5 kg · Retangular · Velas\nRetirada na Loja 1 · Rua Estiva, 200 · 02/10/2026\nPode me passar o valor?",
    );
  });

  it("cart keeps a valid preference and drops an invalid one", () => {
    const raw = (preferred: unknown) => JSON.stringify({ storeSlug: "estiva", lines: [], preferred });
    expect(parseStoredCart(raw({ fulfillment: "entrega", day: "2026-10-02" })).preferred).toEqual({ fulfillment: "entrega", day: "2026-10-02" });
    expect(parseStoredCart(raw({ fulfillment: "drone", day: "2026-10-02" })).preferred).toBeUndefined();
    expect(parseStoredCart(raw({ fulfillment: "retirada", day: "amanhã" })).preferred).toBeUndefined();
  });
});
