// Deleting products from the panel: admin only, never a product that was ordered.
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
const users: string[] = [];
const products: string[] = [];
const codes: string[] = [];
let storeId = "";
let categoryId = "";
let admin: Client;
let attendant: Client;

async function signedInAs(role: "admin" | "atendente") {
  const email = `qa-delete-${role}-${run}@cake67.test`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await service!.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  await service!.from("staff").insert({ user_id: data.user.id, name: `QA ${role}`, role, store_id: role === "admin" ? null : storeId });
  const client = createClient<Database>(url!, anonKey!, options);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return client;
}

async function newProduct() {
  const { data, error } = await service!
    .from("products")
    .insert({ slug: `qa-del-${run}-${products.length}`, name: `QA excluir ${run}`, category_id: categoryId, type: "vitrine", price_cents: 500 })
    .select("id")
    .single();
  if (error) throw error;
  products.push(data.id);
  await service!.from("product_images").insert({ product_id: data.id, path: `products/${data.id}/x.webp` });
  await service!.from("stock").insert({ product_id: data.id, store_id: storeId, quantity: 3 });
  return data.id;
}

beforeAll(async () => {
  if (!configured) return;
  const [{ data: store }, { data: category }] = await Promise.all([
    service!.from("stores").select("id").eq("slug", "estiva").single(),
    service!.from("categories").select("id").eq("kind", "vitrine").limit(1).single(),
  ]);
  storeId = store!.id;
  categoryId = category!.id;
  admin = await signedInAs("admin");
  attendant = await signedInAs("atendente");
});

afterAll(async () => {
  if (!configured) return;
  if (codes.length) await service!.from("orders").delete().in("code", codes);
  if (products.length) await service!.from("products").delete().in("id", products);
  for (const id of users) await service!.auth.admin.deleteUser(id);
});

describe.skipIf(!configured)("delete_product", () => {
  it("admin deletes a product never ordered, with its stock and photo rows", async () => {
    const id = await newProduct();
    const { data, error } = await admin.rpc("delete_product", { p_product_id: id });
    expect(error).toBeNull();
    expect(data).toEqual([`products/${id}/x.webp`]);
    const { data: left } = await service!.from("products").select("id").eq("id", id);
    expect(left).toHaveLength(0);
    const { data: stock } = await service!.from("stock").select("quantity").eq("product_id", id);
    expect(stock).toHaveLength(0);
  });

  it("refuses a product that appears in an order", async () => {
    const id = await newProduct();
    const { data, error } = await anon!.rpc("create_order", {
      p_store_id: storeId,
      p_customer: { name: "QA excluir", whatsapp: `6793${run.replace(/\D/g, "").padEnd(7, "1").slice(0, 7)}`, fulfillment: "retirada" },
      p_items: [{ product_id: id, qty: 1 }],
    });
    if (error) throw error;
    codes.push((data as { code: string }).code);

    const result = await admin.rpc("delete_product", { p_product_id: id });
    expect(result.error?.code).toBe("CK040");
    const { data: still } = await service!.from("products").select("id").eq("id", id);
    expect(still).toHaveLength(1);
  });

  it("attendants and anon cannot delete", async () => {
    const id = await newProduct();
    expect((await attendant.rpc("delete_product", { p_product_id: id })).error?.code).toBe("42501");
    expect((await anon!.rpc("delete_product", { p_product_id: id })).error).not.toBeNull();
    const { data: still } = await service!.from("products").select("id").eq("id", id);
    expect(still).toHaveLength(1);
  });
});
