import { describe, expect, it } from "vitest";
import { keepWeight, minimumChargeNote, sizeFor, sizeName, suggestCake, weightChoices } from "@/lib/cake";
import { addLine, countItems, EMPTY_CART, lineKey, parseStoredCart, rememberedStore, removeLine, setQty, toOrderItems } from "@/lib/cart/cart";
import { formatPickup } from "@/lib/datetime";
import { buildSlots } from "@/lib/schedule";
import { formatTaxId, isValidCnpj, isValidCpf, isValidTaxId } from "@/lib/tax-id";
import { checkoutSchema, orderItemsSchema } from "@/lib/validators/order";
import type { StoreHours } from "@/lib/validators/store";
import { describeItem, renderOrderMessage, whatsappLink, type OrderSummary } from "@/lib/whatsapp";

const P = "0b7c8a5e-8f7a-4c1e-9c55-2f4d2b1a9e01";

describe("tax id", () => {
  it.each(["52998224725", "11144477735"])("accepts CPF %s", (v) => expect(isValidCpf(v)).toBe(true));
  it.each(["52998224724", "11111111111", "123"])("rejects CPF %s", (v) => expect(isValidCpf(v)).toBe(false));
  it("accepts a valid CNPJ and rejects a wrong one", () => {
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("11222333000182")).toBe(false);
  });
  it("accepts punctuation and formats back", () => {
    expect(isValidTaxId("529.982.247-25")).toBe(true);
    expect(isValidTaxId("11.222.333/0001-81")).toBe(true);
    expect(formatTaxId("52998224725")).toBe("529.982.247-25");
    expect(formatTaxId("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("suggestCake", () => {
  const weights = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];
  const formats = ["Redondo", "Retangular", "Régua"];

  const pick = (guests: number, w = weights, f = formats) =>
    suggestCake(guests, w, f)?.options.map((o) => `${sizeName(o.size)} ${o.weightKg}`);

  it.each([
    [8, ["Redondo Mini 1"]],
    [10, ["Redondo Mini 1"]],
    [12, ["Redondo P 1.5", "Régua 2.5"]],
    [18, ["Redondo M 2"]],
    [24, ["Redondo G 2.5"]],
    [30, ["Redondo GG 3.5"]],
    [40, ["Retangular P 4"]],
    [50, ["Retangular M 5.5"]],
    [70, ["Retangular G 7.5"]],
    [200, ["Retangular G 7.5"]],
  ])("%i guests -> %j", (guests, expected) => {
    expect(pick(guests)).toEqual(expected);
  });

  it("charges the smallest offered weight inside the size's range", () => {
    expect(pick(15, [2.3, 2.5], ["Régua"])).toEqual(["Régua 2.3"]);
    expect(pick(10, [1.2, 1.4], ["Redondo"])).toEqual(["Redondo Mini 1.2"]);
  });

  it("only suggests formats and weights the cake offers", () => {
    expect(pick(10, weights, ["Retangular"])).toEqual(["Retangular P 4"]);
    expect(pick(10, [3], ["Redondo"])).toEqual(["Redondo G 3"]);
    expect(suggestCake(10, weights, ["Coração"])).toBeNull();
    expect(suggestCake(0, weights, formats)).toBeNull();
  });

  it("matches formats ignoring accents and case", () => {
    expect(pick(15, weights, ["regua"])).toEqual(["Régua 2.5"]);
  });
});

describe("cake sizes", () => {
  it("offers one weight per menu size and every weight for unknown formats", () => {
    expect(weightChoices("Redondo", [1, 1.5, 2, 2.5, 3, 3.5, 4])).toEqual([1, 1.5, 2, 2.5, 3.5]);
    expect(weightChoices("Coração", [1, 2])).toEqual([1, 2]);
    expect(keepWeight("Retangular", [1, 4, 5.5], 1)).toBe(4);
    expect(keepWeight("Retangular", [1, 4, 5.5], 5.5)).toBe(5.5);
  });

  it("finds the size of a weight and explains the minimum charge", () => {
    const mini = sizeFor("Redondo", 1.2);
    expect(mini?.size).toBe("Mini");
    expect(sizeFor("Retangular", 2)).toBeNull();
    expect(minimumChargeNote(mini!, 1)).toBe(
      "Pesa de 1 a 1,4 kg: cobramos o peso mínimo (1 kg) e, se na pesagem passar disso, a diferença é cobrada na retirada.",
    );
  });
});

describe("buildSlots", () => {
  const hours: StoreHours = {
    mon: { open: "10:00", close: "12:00" },
    tue: { open: "10:00", close: "12:00" },
    wed: null,
    thu: { open: "10:00", close: "12:00" },
    fri: { open: "10:00", close: "12:00" },
    sat: { open: "10:00", close: "12:00" },
    sun: null,
  };

  it("skips closed days and slots before the earliest moment", () => {
    // Tuesday 2026-09-29 10:45 in Campo Grande.
    const days = buildSlots(hours, "2026-09-29T14:45:00.000Z", 3);
    expect(days.map((d) => d.date)).toEqual(["2026-09-29", "2026-10-01"]);
    expect(days[0].slots.map((s) => s.time)).toEqual(["11:00", "11:30"]);
    expect(days[1].slots.map((s) => s.time)).toEqual(["10:00", "10:30", "11:00", "11:30"]);
    expect(days[1].slots[0].iso).toBe("2026-10-01T14:00:00.000Z");
  });
});

describe("cart", () => {
  const base = { productId: P, type: "vitrine" as const, name: "Fatia Karen", imageUrl: "/x", qty: 1 };

  it("merges the same product and caps vitrine at 10", () => {
    let cart = addLine(EMPTY_CART, base);
    cart = addLine(cart, { ...base, qty: 12 });
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].qty).toBe(10);
  });

  it("keeps different cake options as separate lines", () => {
    const cake = { ...base, type: "bolo_kg" as const };
    let cart = addLine(EMPTY_CART, { ...cake, options: { weight_kg: "2", format: "Redondo", addon_ids: ["b", "a"] } });
    cart = addLine(cart, { ...cake, options: { weight_kg: "2", format: "Redondo", addon_ids: ["a", "b"] } });
    cart = addLine(cart, { ...cake, options: { weight_kg: "3", format: "Redondo" } });
    expect(cart.lines.map((l) => l.qty)).toEqual([2, 1]);
    expect(lineKey(P, { format: "Redondo", weight_kg: "2" })).toBe(lineKey(P, { weight_kg: "2", format: "Redondo" }));
  });

  it("changes, removes and converts to order items", () => {
    let cart = addLine(EMPTY_CART, base);
    const key = cart.lines[0].key;
    cart = setQty(cart, key, 3);
    expect(countItems(cart)).toBe(3);
    expect(toOrderItems(cart)).toEqual([{ product_id: P, qty: 3 }]);
    expect(setQty(cart, key, 0).lines).toHaveLength(0);
    expect(removeLine(cart, key).lines).toHaveLength(0);
  });

  it("keeps each weighed piece as its own line with qty 1", () => {
    const piece = { ...base, type: "vitrine_kg" as const, label: "1,34 kg" };
    let cart = addLine(EMPTY_CART, { ...piece, options: { piece_id: "a" } });
    cart = addLine(cart, { ...piece, options: { piece_id: "b" }, label: "1,62 kg" });
    cart = addLine(cart, { ...piece, options: { piece_id: "a" } });
    expect(cart.lines.map((l) => [l.label, l.qty])).toEqual([["1,34 kg", 1], ["1,62 kg", 1]]);
    expect(setQty(cart, cart.lines[0].key, 5).lines[0].qty).toBe(1);
    expect(countItems(cart)).toBe(2);
    expect(toOrderItems(cart)).toEqual([
      { product_id: P, qty: 1, piece_id: "a" },
      { product_id: P, qty: 1, piece_id: "b" },
    ]);
    expect(orderItemsSchema.safeParse([{ product_id: P, qty: 1, piece_id: "x" }]).success).toBe(false);
  });

  it("remembers the store only while the cart has items for a known store", () => {
    const slugs = ["estiva", "afonso-pena"];
    const withItem = addLine({ ...EMPTY_CART, storeSlug: "estiva" }, base);
    expect(rememberedStore(withItem, slugs)).toBe("estiva");
    expect(rememberedStore({ storeSlug: "estiva", lines: [] }, slugs)).toBeNull();
    expect(rememberedStore({ ...withItem, storeSlug: "fechada" }, slugs)).toBeNull();
    expect(rememberedStore(EMPTY_CART, slugs)).toBeNull();
  });

  it("survives corrupted storage", () => {
    expect(parseStoredCart("not json")).toEqual(EMPTY_CART);
    expect(parseStoredCart('{"lines":[{"key":"x"}]}').lines).toEqual([]);
  });
});

describe("describeItem", () => {
  it("shows the weight of a weighed showcase cake", () => {
    expect(
      describeItem({ name: "Bolo Ninho com Morango", type: "vitrine_kg", qty: 1, total_cents: 14740, options: { weight_g: 1340 } }),
    ).toBe("1x Bolo Ninho com Morango 1,34 kg");
  });
});

describe("renderOrderMessage", () => {
  const template =
    "Olá, Cake 67! Pedido *{codigo}*\nLoja: {loja}\n{entrega}\n\n{itens}\n\nSubtotal: {subtotal}\nNome: {nome} · WhatsApp: {whatsapp}\n{observacoes}";
  const order: OrderSummary = {
    code: "C67-000123",
    fulfillment: "retirada",
    delivery_address: null,
    scheduled_for: "2026-09-27T19:00:00.000Z",
    customer_name: "Carla",
    customer_whatsapp: "5567999998888",
    notes: null,
    subtotal_cents: 27180,
    store: { name: "Loja 1", address: "Rua Estiva, 200", whatsapp: "5567981519796", support_whatsapp: "5567993285925" },
    items: [
      { name: "Fatia Karen", type: "vitrine", qty: 2, total_cents: 4400, options: {} },
      {
        name: "Bolo Ninho com Morango",
        type: "bolo_kg",
        qty: 1,
        total_cents: 22780,
        options: { weight_kg: 2, format: "Retangular", addons: [{ name: "Velas" }], message: "Parabéns, Ana" },
      },
    ],
  };

  it("matches the SPEC §5 example", () => {
    expect(renderOrderMessage(template, order, 120)).toBe(
      [
        "Olá, Cake 67! Pedido *C67-000123*",
        "Loja: Rua Estiva, 200",
        "Retirada em 27/09 às 15h",
        "",
        "2x Fatia Karen – R$ 44,00",
        "1x Bolo Ninho com Morango 2 kg, Retangular, Velas – R$ 227,80",
        "",
        "Subtotal: R$ 271,80",
        "Nome: Carla · WhatsApp: (67) 99999-8888",
        'Obs.: frase "Parabéns, Ana"',
      ].join("\n"),
    );
  });

  it("describes delivery, vitrine-only pickup and cento", () => {
    const vitrineOnly = { ...order, scheduled_for: null, items: [order.items[0]], notes: null };
    expect(renderOrderMessage("{entrega}\n{observacoes}", vitrineOnly, 120)).toBe("Retirada em até 2 h");
    const delivery = { ...order, fulfillment: "entrega" as const, delivery_address: "Rua A, 1", notes: "Portão azul" };
    expect(renderOrderMessage("{entrega}", delivery, 120)).toBe("Quero entrega (taxa a combinar) em 27/09 às 15h · Endereço: Rua A, 1");
    const cento = { ...order, items: [{ name: "Coxinha", type: "cento" as const, qty: 50, total_cents: 6000, options: null }] };
    expect(renderOrderMessage("{itens}", cento, 120)).toBe("50 un. Coxinha – R$ 60,00");
  });

  it("builds the wa.me link", () => {
    expect(whatsappLink("5567981519796", "Olá *x*")).toBe("https://wa.me/5567981519796?text=Ol%C3%A1%20*x*");
    expect(formatPickup("2026-09-27T19:30:00.000Z")).toBe("27/09 às 15h30");
  });
});

describe("checkoutSchema", () => {
  const base = { name: " Carla ", whatsapp: "(67) 99999-8888", fulfillment: "retirada", privacy: "on" };

  it("normalizes and drops the address on pickup", () => {
    const parsed = checkoutSchema.parse({ ...base, delivery_address: "Rua A", tax_id: "529.982.247-25" });
    expect(parsed).toMatchObject({ name: "Carla", whatsapp: "5567999998888", tax_id: "52998224725" });
    expect(parsed.delivery_address).toBeUndefined();
  });

  it("requires privacy and a valid tax id when given", () => {
    expect(checkoutSchema.safeParse({ ...base, privacy: undefined }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, tax_id: "123" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, tax_id: "" }).success).toBe(true);
  });

  it("limits order items", () => {
    expect(orderItemsSchema.safeParse([]).success).toBe(false);
    expect(orderItemsSchema.safeParse([{ product_id: P, qty: 1 }]).success).toBe(true);
    expect(orderItemsSchema.safeParse([{ product_id: P, qty: 1, message: "x".repeat(61) }]).success).toBe(false);
  });
});
