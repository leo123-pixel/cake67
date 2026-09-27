// Stage 03 acceptance through the real API: concurrency, audit trail and
// per-store authorization. Restores original quantities with new adjustments
// (history is never deleted) and removes the throwaway users.
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
const run = randomUUID().slice(0, 8);
const service = configured ? createClient<Database>(url!, serviceKey!, options) : null;
const users: string[] = [];

async function signedInAs(role: "admin" | "atendente", storeId: string | null): Promise<Client> {
  const email = `qa-stock-${role}-${run}@cake67.test`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await service!.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const { error: staffError } = await service!
    .from("staff")
    .insert({ user_id: data.user.id, name: `QA ${role}`, role, store_id: storeId });
  if (staffError) throw staffError;
  const client = createClient<Database>(url!, anonKey!, options);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return client;
}

let admin: Client;
let attendant: Client;
const ids = { loja1: "", loja2: "", karen: "", palha: "" };
const original = new Map<string, number>();
const key = (productId: string, storeId: string) => `${productId}:${storeId}`;

async function quantity(productId: string, storeId: string) {
  const { data } = await service!
    .from("stock")
    .select("quantity")
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .maybeSingle();
  return data?.quantity ?? 0;
}

beforeAll(async () => {
  if (!configured) return;
  const { data: stores } = await service!.from("stores").select("id, slug");
  const { data: products } = await service!.from("products").select("id, slug").in("slug", ["fatia-karen", "copo-palha"]);
  ids.loja1 = stores!.find((s) => s.slug === "estiva")!.id;
  ids.loja2 = stores!.find((s) => s.slug === "afonso-pena")!.id;
  ids.karen = products!.find((p) => p.slug === "fatia-karen")!.id;
  ids.palha = products!.find((p) => p.slug === "copo-palha")!.id;

  for (const [product, store] of [[ids.karen, ids.loja1], [ids.karen, ids.loja2], [ids.palha, ids.loja2]]) {
    original.set(key(product, store), await quantity(product, store));
  }

  admin = await signedInAs("admin", null);
  attendant = await signedInAs("atendente", ids.loja2);
});

afterAll(async () => {
  if (!configured) return;
  for (const [k, value] of original) {
    const [product, store] = k.split(":");
    await admin.rpc("set_stock", { p_product_id: product, p_store_id: store, p_quantity: value });
  }
  for (const id of users) await service!.auth.admin.deleteUser(id);
});

describe.skipIf(!configured)("stock functions", () => {
  it("20 concurrent +1 adjustments add exactly 20", async () => {
    const start = await quantity(ids.karen, ids.loja2);
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        attendant.rpc("adjust_stock", { p_product_id: ids.karen, p_store_id: ids.loja2, p_delta: 1 }),
      ),
    );
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(await quantity(ids.karen, ids.loja2)).toBe(start + 20);
  });

  it("records who changed it and the resulting quantity", async () => {
    const { data } = await service!
      .from("stock_movements")
      .select("delta, reason, actor_name, quantity_after")
      .eq("product_id", ids.karen)
      .eq("store_id", ids.loja2)
      .order("id", { ascending: false })
      .limit(1)
      .single();
    expect(data).toMatchObject({ delta: 1, reason: "ajuste", actor_name: "QA atendente" });
    expect(data!.quantity_after).toBe(await quantity(ids.karen, ids.loja2));
  });

  it("attendant cannot adjust nor read another store", async () => {
    const { error } = await attendant.rpc("adjust_stock", { p_product_id: ids.karen, p_store_id: ids.loja1, p_delta: 1 });
    expect(error?.code).toBe("42501");
    const { data } = await attendant.from("stock_movements").select("id").eq("store_id", ids.loja1).limit(1);
    expect(data ?? []).toHaveLength(0);
    const { data: stock } = await attendant.from("stock").select("product_id").eq("store_id", ids.loja1).limit(1);
    expect(stock ?? []).toHaveLength(0);
  });

  it("rejects negative and oversized quantities", async () => {
    const negative = await attendant.rpc("set_stock", { p_product_id: ids.karen, p_store_id: ids.loja2, p_quantity: -1 });
    expect(negative.error?.code).toBe("CK002");
    const huge = await attendant.rpc("set_stock", { p_product_id: ids.karen, p_store_id: ids.loja2, p_quantity: 10000 });
    expect(huge.error?.code).toBe("CK003");
  });

  it("esgotar shows as unavailable to the public", async () => {
    const { error } = await admin.rpc("set_stock", { p_product_id: ids.karen, p_store_id: ids.loja1, p_quantity: 0 });
    expect(error).toBeNull();
    const anon = createClient<Database>(url!, anonKey!, options);
    const { data } = await anon
      .from("product_availability")
      .select("available")
      .eq("product_id", ids.karen)
      .eq("store_id", ids.loja1)
      .single();
    expect(data?.available).toBe(false);
  });

  it("count is all or nothing", async () => {
    const before = [await quantity(ids.karen, ids.loja2), await quantity(ids.palha, ids.loja2)];
    const { error } = await attendant.rpc("count_stock", {
      p_store_id: ids.loja2,
      p_items: [
        { product_id: ids.karen, quantity: 5 },
        { product_id: ids.palha, quantity: -1 },
      ],
    });
    expect(error?.code).toBe("CK002");
    expect([await quantity(ids.karen, ids.loja2), await quantity(ids.palha, ids.loja2)]).toEqual(before);

    const { data: changed, error: countError } = await attendant.rpc("count_stock", {
      p_store_id: ids.loja2,
      p_items: [
        { product_id: ids.karen, quantity: 5 },
        { product_id: ids.palha, quantity: before[1] },
      ],
    });
    expect(countError).toBeNull();
    expect(changed).toBe(before[0] === 5 ? 0 : 1);
    expect(await quantity(ids.karen, ids.loja2)).toBe(5);
  });

  it("the sum of movements equals the quantity for every stock row", async () => {
    const [{ data: stock }, { data: movements }] = await Promise.all([
      service!.from("stock").select("product_id, store_id, quantity"),
      service!.from("stock_movements").select("product_id, store_id, delta").limit(100000),
    ]);
    const sums = new Map<string, number>();
    for (const m of movements!) sums.set(key(m.product_id, m.store_id), (sums.get(key(m.product_id, m.store_id)) ?? 0) + m.delta);
    const mismatched = stock!.filter((row) => (sums.get(key(row.product_id, row.store_id)) ?? 0) !== row.quantity);
    expect(mismatched).toEqual([]);
  });
});
