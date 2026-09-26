// Stage 04 acceptance through the real API: the race for the last unit, the
// expiration that returns stock, and what the public can (not) read.
// Uses a throwaway admin to set stock atomically and cleans everything up.
import { existsSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

type Client = SupabaseClient<Database>;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = configured ? createClient<Database>(url!, serviceKey!, options) : null;
const anon = configured ? createClient<Database>(url!, anonKey!, options) : null;
const run = randomUUID().slice(0, 8);

let admin: Client;
let adminId = "";
const ids = { store: "", product: "" };
let original = 0;
const codes: string[] = [];

async function quantity() {
  const { data } = await service!.from("stock").select("quantity").eq("product_id", ids.product).eq("store_id", ids.store).single();
  return data!.quantity;
}

function phone(n: number) {
  return `6790${run.replace(/\D/g, "").padEnd(4, "7").slice(0, 3)}${String(n).padStart(4, "0")}`;
}

function order(n: number, qty = 1) {
  return anon!.rpc("create_order", {
    p_store_id: ids.store,
    p_customer: { name: `QA ${n}`, whatsapp: phone(n), fulfillment: "retirada", tax_id: "529.982.247-25" },
    p_items: [{ product_id: ids.product, qty }],
  });
}

beforeAll(async () => {
  if (!configured) return;
  const [{ data: store }, { data: product }] = await Promise.all([
    service!.from("stores").select("id").eq("slug", "afonso-pena").single(),
    service!.from("products").select("id").eq("slug", "crunch-cake").single(),
  ]);
  ids.store = store!.id;
  ids.product = product!.id;
  original = await quantity();

  const email = `qa-orders-${run}@cake67.test`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await service!.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  adminId = data.user.id;
  await service!.from("staff").insert({ user_id: adminId, name: "QA pedidos", role: "admin" });
  admin = createClient<Database>(url!, anonKey!, options);
  await admin.auth.signInWithPassword({ email, password });
});

afterAll(async () => {
  if (!configured) return;
  // Expire what is still open (returns stock), then remove the test orders.
  if (codes.length) {
    await service!.from("orders").update({ expires_at: new Date(Date.now() - 60000).toISOString() }).in("code", codes).eq("status", "novo");
    await service!.rpc("expire_orders");
    await service!.from("orders").delete().in("code", codes);
  }
  await admin.rpc("set_stock", { p_product_id: ids.product, p_store_id: ids.store, p_quantity: original });
  await service!.auth.admin.deleteUser(adminId);
});

describe.skipIf(!configured)("orders", () => {
  it("only one of five simultaneous orders gets the last unit", async () => {
    const { error } = await admin.rpc("set_stock", { p_product_id: ids.product, p_store_id: ids.store, p_quantity: 1 });
    expect(error).toBeNull();

    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => order(n)));
    const won = results.filter((r) => !r.error);
    const lost = results.filter((r) => r.error);
    won.forEach((r) => codes.push((r.data as { code: string }).code));

    expect(won).toHaveLength(1);
    expect(lost.map((r) => r.error?.code)).toEqual(["CK010", "CK010", "CK010", "CK010"]);
    expect(await quantity()).toBe(0);
  });

  it("the public can read its order only with the token, never the tax id", async () => {
    const { data: row } = await service!.from("orders").select("code, public_token").eq("code", codes[0]).single();
    const { data: ok } = await anon!.rpc("get_order_public", { p_code: row!.code, p_token: row!.public_token });
    expect(ok).toMatchObject({ code: row!.code, status: "novo" });
    expect(ok).not.toHaveProperty("customer_tax_id");
    const { data: wrong } = await anon!.rpc("get_order_public", { p_code: row!.code, p_token: "0".repeat(32) });
    expect(wrong).toBeNull();
    const { data: rows } = await anon!.from("orders").select("id").limit(1);
    expect(rows ?? []).toHaveLength(0);
  });

  it("an order past its reservation expires once and returns the stock", async () => {
    await service!.from("orders").update({ expires_at: new Date(Date.now() - 60000).toISOString() }).eq("code", codes[0]);
    const { data: first } = await service!.rpc("expire_orders");
    expect(first).toBeGreaterThanOrEqual(1);
    expect(await quantity()).toBe(1);

    await service!.rpc("expire_orders");
    expect(await quantity()).toBe(1);

    const { data: row } = await service!.from("orders").select("status").eq("code", codes[0]).single();
    expect(row!.status).toBe("expirado");
    const { data: moves } = await service!
      .from("stock_movements")
      .select("reason, delta")
      .eq("product_id", ids.product)
      .eq("store_id", ids.store)
      .in("reason", ["reserva", "devolucao"])
      .order("id", { ascending: false })
      .limit(2);
    expect(moves).toEqual([
      { reason: "devolucao", delta: 1 },
      { reason: "reserva", delta: -1 },
    ]);
  });

  it("stores the tax id and the subtotal computed by the database", async () => {
    const { data } = await service!.from("orders").select("customer_tax_id, subtotal_cents").eq("code", codes[0]).single();
    const { data: product } = await service!.from("products").select("price_cents").eq("id", ids.product).single();
    expect(data).toEqual({ customer_tax_id: "52998224725", subtotal_cents: product!.price_cents });
  });

  it("movements still sum to the quantity for every stock row", async () => {
    const [{ data: stock }, { data: movements }] = await Promise.all([
      service!.from("stock").select("product_id, store_id, quantity"),
      service!.from("stock_movements").select("product_id, store_id, delta").limit(100000),
    ]);
    const sums = new Map<string, number>();
    for (const m of movements!) {
      const k = `${m.product_id}:${m.store_id}`;
      sums.set(k, (sums.get(k) ?? 0) + m.delta);
    }
    expect(stock!.filter((r) => (sums.get(`${r.product_id}:${r.store_id}`) ?? 0) !== r.quantity)).toEqual([]);
  });
});
