// Stage 11 acceptance through the real API: the fee only comes from a quote the
// server stored, never from the browser, and anon cannot touch quotes.
// Juma itself is not called here (see `npm run juma:check`).
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
const ids = { store: "", otherStore: "", product: "" };
let original = 0;
const codes: string[] = [];
const quotes: string[] = [];
const address = { delivery_street: `Rua QA ${run}`, delivery_number: "1500", delivery_district: "Centro" };

function phone(n: number) {
  return `6791${run.replace(/\D/g, "").padEnd(4, "7").slice(0, 3)}${String(n).padStart(4, "0")}`;
}

async function saveQuote(row: Partial<Database["public"]["Tables"]["delivery_quotes"]["Insert"]> = {}) {
  const { data, error } = await service!
    .from("delivery_quotes")
    .insert({
      store_id: ids.store,
      address_key: `${address.delivery_street}|1500|Centro`,
      street: address.delivery_street,
      number: "1500",
      district: "Centro",
      status: "ok",
      fee_cents: 1240,
      category_id: "1",
      ...row,
    })
    .select("id")
    .single();
  if (error) throw error;
  quotes.push(data.id);
  return data.id;
}

function order(n: number, customer: Record<string, unknown>, store = ids.store) {
  return anon!.rpc("create_order", {
    p_store_id: store,
    p_customer: { name: `QA entrega ${n}`, whatsapp: phone(n), fulfillment: "entrega", ...customer },
    p_items: [{ product_id: ids.product, qty: 1 }],
  });
}

async function saved(result: { data: unknown; error: unknown }) {
  expect(result.error).toBeNull();
  const code = (result.data as { code: string }).code;
  codes.push(code);
  const { data } = await service!
    .from("orders")
    .select("code, public_token, delivery_fee_cents, total_cents, subtotal_cents, delivery_quote_id, delivery_address, delivery_street")
    .eq("code", code)
    .single();
  return data!;
}

beforeAll(async () => {
  if (!configured) return;
  const [{ data: store }, { data: other }, { data: product }] = await Promise.all([
    service!.from("stores").select("id").eq("slug", "estiva").single(),
    service!.from("stores").select("id").eq("slug", "afonso-pena").single(),
    service!.from("products").select("id").eq("slug", "crunch-cake").single(),
  ]);
  ids.store = store!.id;
  ids.otherStore = other!.id;
  ids.product = product!.id;
  const { data: stock } = await service!.from("stock").select("quantity").eq("product_id", ids.product).eq("store_id", ids.store).single();
  original = stock!.quantity;

  const email = `qa-delivery-${run}@cake67.test`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await service!.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  adminId = data.user.id;
  await service!.from("staff").insert({ user_id: adminId, name: "QA entrega", role: "admin" });
  admin = createClient<Database>(url!, anonKey!, options);
  await admin.auth.signInWithPassword({ email, password });
  await admin.rpc("set_stock", { p_product_id: ids.product, p_store_id: ids.store, p_quantity: 20 });
});

afterAll(async () => {
  if (!configured) return;
  if (codes.length) {
    await service!.from("orders").update({ expires_at: new Date(Date.now() - 60000).toISOString() }).in("code", codes).eq("status", "novo");
    await service!.rpc("expire_orders");
    await service!.from("orders").delete().in("code", codes);
  }
  if (quotes.length) await service!.from("delivery_quotes").delete().in("id", quotes);
  await admin.rpc("set_stock", { p_product_id: ids.product, p_store_id: ids.store, p_quantity: original });
  await service!.auth.admin.deleteUser(adminId);
});

describe.skipIf(!configured)("delivery fee (stage 11)", () => {
  it("uses the stored quote and adds it to the total", async () => {
    const quote = await saveQuote();
    const row = await saved(await order(1, { ...address, delivery_street: ` ${address.delivery_street.toUpperCase()} `, delivery_quote_id: quote }));
    expect(row.delivery_fee_cents).toBe(1240);
    expect(row.total_cents).toBe(row.subtotal_cents + 1240);
    expect(row.delivery_quote_id).toBe(quote);
    expect(row.delivery_address).toContain("1500 · Centro");

    const { data } = await anon!.rpc("get_order_delivery", { p_code: row.code, p_token: row.public_token });
    expect(data).toEqual({ delivery_fee_cents: 1240, total_cents: row.total_cents });
    const { data: wrong } = await anon!.rpc("get_order_delivery", { p_code: row.code, p_token: "0".repeat(32) });
    expect(wrong).toBeNull();
  });

  it("ignores a fee sent by the browser", async () => {
    const row = await saved(await order(2, { ...address, delivery_fee_cents: 1, fee_cents: 1 }));
    expect(row.delivery_fee_cents).toBeNull();
    expect(row.total_cents).toBe(row.subtotal_cents);
  });

  it("refuses a quote of another address, store, an old or a failed one", async () => {
    const quote = await saveQuote();
    const old = await saveQuote({ created_at: new Date(Date.now() - 40 * 60000).toISOString() });
    const failed = await saveQuote({ status: "falhou", fee_cents: null, error: "QA" });
    const results = await Promise.all([
      order(3, { ...address, delivery_number: "1600", delivery_quote_id: quote }),
      order(4, { ...address, delivery_quote_id: quote }, ids.otherStore),
      order(5, { ...address, delivery_quote_id: old }),
      order(6, { ...address, delivery_quote_id: failed }),
      order(7, { ...address, delivery_quote_id: randomUUID() }),
    ]);
    expect(results.map((r) => r.error?.code)).toEqual(["CK016", "CK016", "CK016", "CK016", "CK016"]);
  });

  it("requires street, number and district once any field is sent", async () => {
    const { error } = await order(8, { delivery_street: "Rua A", delivery_number: "1" });
    expect(error?.code).toBe("CK011");
    expect(error?.details).toBe("delivery_district");
  });

  it("keeps the free-text address of the site before this stage", async () => {
    const row = await saved(await order(9, { delivery_address: "Rua antiga, 10" }));
    expect(row.delivery_address).toBe("Rua antiga, 10");
    expect(row.delivery_street).toBeNull();
    expect(row.delivery_fee_cents).toBeNull();
  });

  it("anon and staff cannot read quotes", async () => {
    const { data: anonRows } = await anon!.from("delivery_quotes").select("id").limit(1);
    expect(anonRows ?? []).toHaveLength(0);
    const { data: staffRows } = await admin.from("delivery_quotes").select("id").limit(1);
    expect(staffRows ?? []).toHaveLength(0);
  });
});
