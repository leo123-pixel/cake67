import { describe, expect, it } from "vitest";
import { csvCell, csvCents, csvDateTime, toCsv } from "@/lib/csv";
import { fillDays, resolvePeriod } from "@/lib/report";
import { bakeryJsonLd, jsonLdScript, productJsonLd } from "@/lib/structured-data";
import { settingsSchema } from "@/lib/validators/settings";
import { renderOrderMessage, SAMPLE_ORDER, templateProblems } from "@/lib/whatsapp";

const SEED_TEMPLATE =
  "Olá, Cake 67! Pedido *{codigo}*\nLoja: {loja}\n{entrega}\n\n{itens}\n\nSubtotal: {subtotal}\nNome: {nome} · WhatsApp: {whatsapp}\n{observacoes}";

describe("resolvePeriod", () => {
  const today = "2026-09-26";

  it.each([
    ["hoje", "2026-09-26", "2026-09-26"],
    ["7d", "2026-09-20", "2026-09-26"],
    ["mes", "2026-09-01", "2026-09-26"],
    ["mes_passado", "2026-08-01", "2026-08-31"],
  ])("%s -> %s..%s", (preset, from, to) => {
    expect(resolvePeriod(preset, undefined, undefined, today)).toEqual({ preset, from, to });
  });

  it("defaults to this month", () => {
    expect(resolvePeriod(undefined, undefined, undefined, today)).toMatchObject({ preset: "mes", from: "2026-09-01" });
  });

  it("last month across the year boundary", () => {
    expect(resolvePeriod("mes_passado", undefined, undefined, "2026-01-15")).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("7 days across a month boundary", () => {
    expect(resolvePeriod("7d", undefined, undefined, "2026-03-03")).toMatchObject({ from: "2026-02-25", to: "2026-03-03" });
  });

  it("keeps a valid custom period", () => {
    expect(resolvePeriod("personalizado", "2026-01-10", "2026-02-10", today)).toEqual({
      preset: "personalizado",
      from: "2026-01-10",
      to: "2026-02-10",
    });
  });

  it.each([
    ["2026-02-10", "2026-01-10"],
    ["2026-02-30", "2026-03-10"],
    ["2024-01-01", "2026-01-01"],
    ["", "2026-01-01"],
  ])("invalid custom %s..%s falls back to this month with a notice", (from, to) => {
    const period = resolvePeriod("personalizado", from, to, today);
    expect(period).toMatchObject({ preset: "mes", from: "2026-09-01", to: today });
    expect(period.notice).toBeTruthy();
  });
});

describe("fillDays", () => {
  it("adds empty days", () => {
    const days = fillDays([{ day: "2026-09-02", orders: 2, revenue_cents: 500 }], "2026-09-01", "2026-09-03");
    expect(days.map((d) => [d.day, d.orders])).toEqual([["2026-09-01", 0], ["2026-09-02", 2], ["2026-09-03", 0]]);
  });

  it("keeps only days with orders in long periods", () => {
    const byDay = [{ day: "2026-03-02", orders: 1, revenue_cents: 100 }];
    expect(fillDays(byDay, "2026-01-01", "2026-06-30")).toEqual(byDay);
  });
});

describe("csv", () => {
  it("uses BOM, semicolons and CRLF", () => {
    expect(toCsv(["a", "b"], [["x", 1]])).toBe("﻿a;b\r\nx;1\r\n");
  });

  it("quotes separators, quotes and line breaks", () => {
    expect(csvCell('Bolo "Ninho"; 2 kg')).toBe('"Bolo ""Ninho""; 2 kg"');
    expect(csvCell("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"');
  });

  it.each(["=HYPERLINK(1)", "+5567", "-2", "@SUM(A1)", "\tx"])("neutralizes formula %j", (value) => {
    expect(csvCell(value).replace(/^"/, "").startsWith("'")).toBe(true);
  });

  it("keeps numbers and empty values", () => {
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(null)).toBe("");
  });

  it.each([
    [123450, "1234,50"],
    [5, "0,05"],
    [-250, "-2,50"],
    [null, ""],
  ])("csvCents(%s) = %s", (cents, text) => {
    expect(csvCents(cents)).toBe(text);
  });

  it("formats dates in Campo Grande", () => {
    expect(csvDateTime("2026-09-27T03:30:00Z")).toBe("26/09/2026 23:30");
    expect(csvDateTime(null)).toBe("");
  });
});

describe("template", () => {
  it("seed template has no problems", () => {
    expect(templateProblems(SEED_TEMPLATE)).toEqual({ missing: [], unknown: [] });
  });

  it("finds missing required and unknown variables", () => {
    expect(templateProblems("Pedido {cliente} {codigo} {cliente}")).toEqual({ missing: ["itens"], unknown: ["cliente"] });
  });

  it("renders the sample order", () => {
    const text = renderOrderMessage(SEED_TEMPLATE, SAMPLE_ORDER, 120);
    expect(text).toContain("C67-000123");
    expect(text).toContain("2x Fatia Karen – R$ 44,00");
    expect(text).toContain("Retirada em até 2 h");
  });
});

describe("settingsSchema", () => {
  const valid = { reservation_minutes: "120", order_whatsapp_template: SEED_TEMPLATE, privacy_text: "Texto", privacy_reviewed: "on" };

  it("accepts valid settings", () => {
    expect(settingsSchema.parse(valid)).toMatchObject({ reservation_minutes: 120, privacy_reviewed: true });
  });

  it.each([
    [{ reservation_minutes: "10" }, "reservation_minutes"],
    [{ reservation_minutes: "1441" }, "reservation_minutes"],
    [{ reservation_minutes: "90.5" }, "reservation_minutes"],
    [{ order_whatsapp_template: "Pedido {codigo}" }, "order_whatsapp_template"],
    [{ order_whatsapp_template: "{codigo} {itens} {preco}" }, "order_whatsapp_template"],
    [{ privacy_text: "x".repeat(20001) }, "privacy_text"],
  ])("rejects %j", (override, field) => {
    const result = settingsSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual([field]);
  });

  it("stores textarea line breaks as \\n", () => {
    const parsed = settingsSchema.parse({ ...valid, order_whatsapp_template: "{codigo}\r\n{itens}\r\n", privacy_text: "A\r\n\r\nB" });
    expect(parsed.order_whatsapp_template).toBe("{codigo}\n{itens}");
    expect(parsed.privacy_text).toBe("A\n\nB");
  });

  it("unchecked review is false", () => {
    expect(settingsSchema.parse({ ...valid, privacy_reviewed: undefined }).privacy_reviewed).toBe(false);
  });
});

describe("structured data", () => {
  const siteUrl = "https://cake67.com.br";

  it("bakery with address, phone and opening hours (closed days omitted)", () => {
    const data = bakeryJsonLd(
      {
        name: "Loja 1",
        address: "Rua Estiva, 200",
        phone: "(67) 3026-8816",
        hours: { mon: { open: "10:00", close: "19:00" }, sun: { open: "09:00", close: "12:00" }, tue: null },
      },
      siteUrl,
    );
    expect(data).toMatchObject({ "@type": "Bakery", name: "Cake 67 · Loja 1", telephone: "(67) 3026-8816" });
    expect(data.address.streetAddress).toBe("Rua Estiva, 200");
    expect(data.openingHoursSpecification).toEqual([
      { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Monday", opens: "10:00", closes: "19:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Sunday", opens: "09:00", closes: "12:00" },
    ]);
  });

  const product = {
    slug: "fatia-karen",
    name: "Fatia Karen",
    description: "Fatia",
    type: "vitrine" as const,
    priceCents: 2490,
    images: [{ url: "https://x/img.webp", alt: "Fatia" }],
    stores: [{ id: "1", slug: "estiva", name: "Loja 1", availableQty: 0 }],
  };

  it("product offer in reais, out of stock when no store has it", () => {
    const data = productJsonLd(product, siteUrl);
    expect(data.offers).toMatchObject({ price: "24.90", priceCurrency: "BRL", availability: "https://schema.org/OutOfStock" });
    expect(data.url).toBe("https://cake67.com.br/produto/fatia-karen");
  });

  it("in stock when a store has it; made-to-order has no availability", () => {
    expect(productJsonLd({ ...product, stores: [{ ...product.stores[0], availableQty: 3 }] }, siteUrl).offers.availability).toBe(
      "https://schema.org/InStock",
    );
    expect(productJsonLd({ ...product, type: "bolo_kg", stores: [] }, siteUrl).offers).not.toHaveProperty("availability");
  });

  it("script text never closes the tag", () => {
    expect(jsonLdScript({ name: "</script><b>" })).not.toContain("<");
  });
});
