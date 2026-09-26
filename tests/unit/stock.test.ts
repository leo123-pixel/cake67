import { describe, expect, it } from "vitest";
import { buildStockGrid, type GridProduct } from "@/lib/stock-grid";
import { countFieldName, parseCountForm, stockQuantity } from "@/lib/validators/stock";

const P1 = "0b7c8a5e-8f7a-4c1e-9c55-2f4d2b1a9e01";
const P2 = "0b7c8a5e-8f7a-4c1e-9c55-2f4d2b1a9e02";
const STORE = "s1";

describe("stockQuantity", () => {
  it.each([
    ["0", 0],
    ["12", 12],
    [" 9999 ", 9999],
  ])("accepts %j", (text, value) => {
    expect(stockQuantity.parse(text)).toBe(value);
  });

  it.each(["", "-1", "2,5", "2.5", "abc", "10000"])("rejects %j", (text) => {
    expect(stockQuantity.safeParse(text).success).toBe(false);
  });
});

describe("parseCountForm", () => {
  it("collects valid items and per-field errors, keeping raw values", () => {
    const fd = new FormData();
    fd.append(countFieldName(P1), "7");
    fd.append(countFieldName(P2), "-1");
    fd.append("qty_not-a-uuid", "3");
    fd.append("other", "x");

    const { items, errors, values } = parseCountForm(fd);
    expect(items).toEqual([{ product_id: P1, quantity: 7 }]);
    expect(Object.keys(errors)).toEqual([countFieldName(P2)]);
    expect(values).toEqual({ [countFieldName(P1)]: "7", [countFieldName(P2)]: "-1" });
  });
});

describe("buildStockGrid", () => {
  const cat = (id: string, sort: number) => ({ id, name: id.toUpperCase(), sort });
  const product = (overrides: Partial<GridProduct>): GridProduct => ({
    id: P1,
    name: "Item",
    active: true,
    price_pending: false,
    store_ids: [],
    sort: 1,
    category: cat("a", 1),
    ...overrides,
  });

  it("groups by category order and treats missing rows as 0", () => {
    const { groups, hidden } = buildStockGrid(
      [
        product({ id: "x", name: "Croissant", category: cat("b", 2) }),
        product({ id: "y", name: "Fatia", category: cat("a", 1) }),
      ],
      [{ product_id: "y", store_id: STORE, quantity: 4 }, { product_id: "x", store_id: "other", quantity: 9 }],
      STORE,
    );
    expect(groups.map((g) => g.categoryId)).toEqual(["a", "b"]);
    expect(groups[0].items[0]).toMatchObject({ name: "Fatia", quantity: 4 });
    expect(groups[1].items[0]).toMatchObject({ name: "Croissant", quantity: 0 });
    expect(hidden).toEqual([]);
  });

  it("moves items off the site to hidden with the reason", () => {
    const { groups, hidden } = buildStockGrid(
      [
        product({ id: "i", name: "Inativo", active: false }),
        product({ id: "p", name: "Pendente", price_pending: true }),
        product({ id: "o", name: "Outra loja", store_ids: ["other"] }),
        product({ id: "v", name: "Visível", store_ids: [STORE] }),
      ],
      [],
      STORE,
    );
    expect(groups.flatMap((g) => g.items.map((i) => i.name))).toEqual(["Visível"]);
    expect(hidden.map((i) => [i.name, i.hiddenReason])).toEqual([
      ["Inativo", "inativo"],
      ["Outra loja", "não vendido nesta loja"],
      ["Pendente", "preço a definir"],
    ]);
  });
});
