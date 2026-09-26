import { describe, expect, it } from "vitest";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime";
import { addonSchema, categorySchema } from "@/lib/validators/catalog";
import { readForm, toFieldErrors } from "@/lib/validators/common";
import { highlightSchema } from "@/lib/validators/highlight";
import { productSchema, toProductRow } from "@/lib/validators/product";
import { staffInviteSchema, staffUpdateSchema } from "@/lib/validators/staff";
import { readHours, storeSchema, WEEK_DAYS } from "@/lib/validators/store";

const CATEGORY = "0b7c8a5e-8f7a-4c1e-9c55-2f4d2b1a9e01";
const STORE = "1b7c8a5e-8f7a-4c1e-9c55-2f4d2b1a9e02";

const errorsOf = (result: { success: boolean; error?: import("zod").ZodError }) =>
  result.success ? {} : toFieldErrors(result.error!);

describe("productSchema", () => {
  const base = { name: "Água com gás", category_id: CATEGORY, price: "6,50", active: "on" };

  it("accepts a vitrine product and converts the price", () => {
    const result = productSchema.parse({ ...base, type: "vitrine" });
    expect(result.price_cents).toBe(650);
    expect(result.active).toBe(true);
    expect(result.price_pending).toBe(false);
    expect(result.store_ids).toEqual([]);
  });

  it("requires a valid price unless it is pending", () => {
    expect(errorsOf(productSchema.safeParse({ ...base, type: "vitrine", price: "" }))).toHaveProperty("price");
    expect(errorsOf(productSchema.safeParse({ ...base, type: "vitrine", price: "abc" }))).toHaveProperty("price");
    const pending = productSchema.parse({ ...base, type: "vitrine", price: "", price_pending: "on" });
    expect(pending.price_cents).toBe(0);
    expect(pending.price_pending).toBe(true);
  });

  it("requires weights and formats for cakes", () => {
    const errors = errorsOf(productSchema.safeParse({ ...base, type: "bolo_kg", weights_kg: [], formats: "", lead_time_hours: "48" }));
    expect(errors).toHaveProperty("weights_kg");
    expect(errors).toHaveProperty("formats");
  });

  it("maps a cake to its columns", () => {
    const input = productSchema.parse({
      ...base,
      type: "bolo_kg",
      weights_kg: ["1", "1.5"],
      formats: "Redondo, Retangular ,",
      lead_time_hours: "48",
      addon_ids: [],
    });
    const row = toProductRow(input);
    expect(row).toMatchObject({ weights_kg: [1, 1.5], formats: ["Redondo", "Retangular"], lead_time_hours: 48, min_qty: null });
  });

  it("requires min and step for cento", () => {
    const errors = errorsOf(productSchema.safeParse({ ...base, type: "cento", min_qty: "", step_qty: "0", lead_time_hours: "48" }));
    expect(errors).toHaveProperty("min_qty");
    expect(errors).toHaveProperty("step_qty");
  });

  it("requires contents for kits and clears cake fields", () => {
    expect(errorsOf(productSchema.safeParse({ ...base, type: "kit", kit_contents: " ", lead_time_hours: "24" }))).toHaveProperty("kit_contents");
    const row = toProductRow(productSchema.parse({ ...base, type: "kit", kit_contents: "10 docinhos", lead_time_hours: "24" }));
    expect(row).toMatchObject({ kit_contents: "10 docinhos", weights_kg: [], formats: [] });
  });

  it("rejects a missing name and category", () => {
    const errors = errorsOf(productSchema.safeParse({ ...base, type: "vitrine", name: " ", category_id: "" }));
    expect(errors).toHaveProperty("name");
    expect(errors).toHaveProperty("category_id");
  });
});

describe("category and addon", () => {
  it("validates a category", () => {
    expect(categorySchema.parse({ name: "Bebidas", kind: "vitrine", active: "on" })).toEqual({ name: "Bebidas", kind: "vitrine", active: true });
    expect(categorySchema.safeParse({ name: "", kind: "x" }).success).toBe(false);
  });

  it("converts the addon price", () => {
    expect(addonSchema.parse({ name: "Velas", price_cents: "8" }).price_cents).toBe(800);
  });
});

describe("storeSchema", () => {
  const form = (overrides: Record<string, string> = {}) => {
    const data: Record<string, string> = { name: "Loja 1", address: "Rua Estiva, 200", whatsapp: "(67) 98151-9796", active: "on" };
    for (const day of WEEK_DAYS) Object.assign(data, { [`${day}_open`]: "10:00", [`${day}_close`]: "19:00" });
    Object.assign(data, overrides);
    return { ...data, hours: readHours(data) };
  };

  it("normalizes WhatsApp and reads hours", () => {
    const store = storeSchema.parse(form({ sun_closed: "on" }));
    expect(store.whatsapp).toBe("5567981519796");
    expect(store.hours.sun).toBeNull();
    expect(store.hours.mon).toEqual({ open: "10:00", close: "19:00" });
  });

  it("rejects close before open on the right day", () => {
    const errors = errorsOf(storeSchema.safeParse(form({ sat_close: "09:00" })));
    expect(errors).toHaveProperty("hours.sat.close");
  });

  it("rejects an invalid WhatsApp", () => {
    expect(errorsOf(storeSchema.safeParse(form({ whatsapp: "123" })))).toHaveProperty("whatsapp");
  });
});

describe("highlightSchema", () => {
  const base = { slot: "bolo_do_mes", title: "Bolo do Mês", active: "on" };

  it("accepts site paths and https links", () => {
    expect(highlightSchema.safeParse({ ...base, cta_label: "Ver", cta_href: "/cardapio" }).success).toBe(true);
    expect(highlightSchema.safeParse({ ...base, cta_label: "Ver", cta_href: "https://instagram.com/cake67cg" }).success).toBe(true);
  });

  it.each(["javascript:alert(1)", "//evil.com", "http://x.com"])("rejects %s", (href) => {
    expect(errorsOf(highlightSchema.safeParse({ ...base, cta_label: "Ver", cta_href: href }))).toHaveProperty("cta_href");
  });

  it("requires label and link together", () => {
    expect(errorsOf(highlightSchema.safeParse({ ...base, cta_label: "Ver" }))).toHaveProperty("cta_label");
  });

  it("requires end after start and converts to Campo Grande time", () => {
    const ok = highlightSchema.parse({ ...base, starts_at: "2026-10-01T00:00", ends_at: "2026-10-31T23:59" });
    expect(ok.starts_at).toBe("2026-10-01T04:00:00.000Z");
    expect(errorsOf(highlightSchema.safeParse({ ...base, starts_at: "2026-10-02T00:00", ends_at: "2026-10-01T00:00" }))).toHaveProperty("ends_at");
  });
});

describe("staff schemas", () => {
  it("requires a store for attendants", () => {
    expect(errorsOf(staffUpdateSchema.safeParse({ name: "Ana", role: "atendente", store_id: "" }))).toHaveProperty("store_id");
  });

  it("drops the store of admins and normalizes the e-mail", () => {
    const invite = staffInviteSchema.parse({ name: "Ana", role: "admin", store_id: STORE, email: " Ana@Cake67.com " });
    expect(invite).toMatchObject({ email: "ana@cake67.com", store_id: null });
  });
});

describe("helpers", () => {
  it("round-trips datetime-local values", () => {
    expect(isoToLocalInput(localInputToIso("2026-09-26T15:30"))).toBe("2026-09-26T15:30");
  });

  it("reads repeated form keys as arrays", () => {
    const fd = new FormData();
    fd.append("name", "Bolo");
    fd.append("weights_kg", "1");
    fd.append("weights_kg", "2");
    expect(readForm(fd, ["weights_kg", "store_ids"])).toEqual({ name: "Bolo", weights_kg: ["1", "2"], store_ids: [] });
  });
});
