// Acceptance for stage 01: the anon key reads the active catalog and nothing else.
// Runs against the real Supabase project: npm run test:integration
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const configured = Boolean(url && anonKey);

if (!configured) {
  console.warn("Skipping integration tests: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY not set.");
}

const anon = configured
  ? createClient<Database>(url!, anonKey!, { auth: { persistSession: false } })
  : null;

type TableName = keyof Database["public"]["Tables"];

const PRIVATE_TABLES = [
  "orders",
  "order_items",
  "stock",
  "stock_movements",
  "staff",
  "settings",
] as const satisfies TableName[];

const id = randomUUID();

// Rows that would be valid if RLS allowed them.
const INSERTS: { [T in TableName]: Database["public"]["Tables"][T]["Insert"] } = {
  stores: { slug: `t-${id}`, name: "x", address: "x", whatsapp: "5567999999999" },
  categories: { slug: `t-${id}`, name: "x", kind: "vitrine" },
  products: { slug: `t-${id}`, name: "x", category_id: id, type: "vitrine", price_cents: 1 },
  product_images: { product_id: id, path: "x.webp" },
  addons: { name: `t-${id}`, price_cents: 1 },
  product_addons: { product_id: id, addon_id: id },
  stock: { product_id: id, store_id: id, quantity: 1 },
  orders: {
    store_id: id,
    customer_name: "x",
    customer_whatsapp: "5567999999999",
    fulfillment: "retirada",
    subtotal_cents: 0,
  },
  order_items: {
    order_id: id,
    name_snapshot: "x",
    type: "vitrine",
    qty: 1,
    unit_price_cents: 0,
    total_cents: 0,
  },
  stock_movements: { product_id: id, store_id: id, delta: 1, reason: "ajuste" },
  staff: { user_id: id, name: "x", role: "admin" },
  highlights: { slot: "banner", title: "x" },
  settings: { id: 1, order_whatsapp_template: "x" },
};

describe.skipIf(!configured)("anon access (RLS)", () => {
  it.each(PRIVATE_TABLES)("reads no rows from %s", async (table) => {
    const { data } = await anon!.from(table).select("*").limit(1);
    expect(data ?? []).toHaveLength(0);
  });

  it.each(Object.keys(INSERTS) as TableName[])("cannot insert into %s", async (table) => {
    const { error } = await anon!.from(table).insert(INSERTS[table] as never);
    expect(error?.code).toBe("42501");
  });

  it("cannot update products", async () => {
    const { data } = await anon!.from("products").update({ price_cents: 1 }).neq("slug", "").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot delete categories", async () => {
    const { data } = await anon!.from("categories").delete().neq("slug", "").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("sees only active products", async () => {
    const { data, error } = await anon!.from("products").select("active, type");
    expect(error).toBeNull();
    expect(data!.every((p) => p.active)).toBe(true);
    expect(data!.filter((p) => p.type === "vitrine")).toHaveLength(20);
  });

  it("reads availability with capped quantity", async () => {
    const { data, error } = await anon!.from("product_availability").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(40);
    expect(data!.every((row) => (row.quantity ?? 0) <= 10)).toBe(true);
    expect(data!.filter((row) => !row.available)).toHaveLength(6);
  });

  it("sees both seeded stores", async () => {
    const { data } = await anon!.from("stores").select("slug").order("sort");
    expect(data?.map((s) => s.slug)).toEqual(["estiva", "afonso-pena"]);
  });
});
