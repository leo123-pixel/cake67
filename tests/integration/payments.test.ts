// Stage 12 acceptance through the real API: only the service role opens links
// and settles payments, the amount comes from the order, a repeated
// transaction changes nothing, and a payment that does not fit goes to
// "conferir". InfinitePay itself is not called here (see README, Pagamentos).
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
const handle = `qa-${run}`;

let admin: Client;
let adminId = "";
const ids = { store: "", product: "" };
let originalStock = 0;
let originalHandle: string | null = null;
const codes: string[] = [];

function phone(n: number) {
  return `6792${run.replace(/\D/g, "").padEnd(4, "7").slice(0, 3)}${String(n).padStart(4, "0")}`;
}

async function newOrder(n: number, customer: Record<string, unknown> = {}) {
  const { data, error } = await anon!.rpc("create_order", {
    p_store_id: ids.store,
    p_customer: { name: `QA pagamento ${n}`, whatsapp: phone(n), fulfillment: "retirada", ...customer },
    p_items: [{ product_id: ids.product, qty: 1 }],
  });
  expect(error).toBeNull();
  const code = (data as { code: string }).code;
  codes.push(code);
  const { data: row } = await service!.from("orders").select("*").eq("code", code).single();
  return row!;
}

async function reload(id: string) {
  const { data } = await service!.from("orders").select("*").eq("id", id).single();
  return data!;
}

function settle(orderId: string, nsu: string, amount: number) {
  return service!.rpc("settle_online_payment", {
    p_order_id: orderId,
    p_transaction_nsu: nsu,
    p_invoice_slug: "qa-slug",
    p_amount_cents: amount,
    p_paid_amount_cents: amount,
    p_installments: 1,
    p_capture_method: "pix",
    p_receipt_url: "https://recibo.infinitepay.io/qa",
  });
}

beforeAll(async () => {
  if (!configured) return;
  const [{ data: store }, { data: product }] = await Promise.all([
    service!.from("stores").select("id, payment_handle").eq("slug", "estiva").single(),
    service!.from("products").select("id").eq("slug", "crunch-cake").single(),
  ]);
  ids.store = store!.id;
  ids.product = product!.id;
  originalHandle = store!.payment_handle;
  // No key exists for this handle: the live site keeps showing WhatsApp.
  await service!.from("stores").update({ payment_handle: handle }).eq("id", ids.store);
  const { data: stock } = await service!.from("stock").select("quantity").eq("product_id", ids.product).eq("store_id", ids.store).single();
  originalStock = stock!.quantity;

  const email = `qa-payment-${run}@cake67.test`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await service!.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  adminId = data.user.id;
  await service!.from("staff").insert({ user_id: adminId, name: "QA pagamento", role: "admin" });
  admin = createClient<Database>(url!, anonKey!, options);
  await admin.auth.signInWithPassword({ email, password });
  await admin.rpc("set_stock", { p_product_id: ids.product, p_store_id: ids.store, p_quantity: 20 });
});

afterAll(async () => {
  if (!configured) return;
  if (codes.length) await service!.from("orders").delete().in("code", codes);
  await service!.from("stores").update({ payment_handle: originalHandle }).eq("id", ids.store);
  await admin.rpc("set_stock", { p_product_id: ids.product, p_store_id: ids.store, p_quantity: originalStock });
  await service!.auth.admin.deleteUser(adminId);
});

describe.skipIf(!configured)("online payment (stage 12)", () => {
  it("is service role only", async () => {
    const row = await newOrder(1);
    const begin = await anon!.rpc("begin_online_payment", { p_code: row.code, p_token: row.public_token });
    expect(begin.error?.code).toBe("42501");
    const staff = await admin.rpc("settle_online_payment", {
      p_order_id: row.id,
      p_transaction_nsu: "x",
      p_invoice_slug: null,
      p_amount_cents: row.total_cents,
      p_paid_amount_cents: null,
      p_installments: null,
      p_capture_method: null,
      p_receipt_url: null,
    });
    expect(staff.error?.code).toBe("42501");
    const { data } = await admin.from("orders").update({ payment_status: "pago" }).eq("id", row.id).select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("charges the order total and settles once", async () => {
    const row = await newOrder(2);
    const { data: begin, error } = await service!.rpc("begin_online_payment", { p_code: row.code, p_token: row.public_token });
    expect(error).toBeNull();
    expect((begin as { amount_cents: number }).amount_cents).toBe(row.total_cents);

    const first = await settle(row.id, `nsu-${run}-1`, row.total_cents);
    expect(first.data).toMatchObject({ action: "ok" });
    const again = await settle(row.id, `nsu-${run}-1`, row.total_cents);
    expect(again.data).toMatchObject({ action: "duplicate" });

    const paid = await reload(row.id);
    expect(paid).toMatchObject({ payment_status: "pago", status: "novo", expires_at: null, capture_method: "pix" });

    // One reservation movement, no second stock change for the payment.
    const { data: moves } = await service!.from("stock_movements").select("delta").eq("order_id", row.id);
    expect(moves).toEqual([{ delta: -1 }]);

    const { data: page } = await anon!.rpc("get_order_public", { p_code: row.code, p_token: row.public_token });
    expect((page as { payment: Record<string, unknown> }).payment).toMatchObject({ status: "pago", method: "pix", handle: null });
    expect(JSON.stringify(page)).not.toContain(`nsu-${run}-1`);
  });

  it("sends a wrong amount or a second payment to conferir", async () => {
    const row = await newOrder(3);
    await service!.rpc("begin_online_payment", { p_code: row.code, p_token: row.public_token });
    expect((await settle(row.id, `nsu-${run}-2`, row.total_cents + 1)).data).toMatchObject({ action: "review" });
    expect(await reload(row.id)).toMatchObject({ payment_status: "conferir" });

    const other = await newOrder(4);
    await service!.rpc("begin_online_payment", { p_code: other.code, p_token: other.public_token });
    await settle(other.id, `nsu-${run}-3`, other.total_cents);
    expect((await settle(other.id, `nsu-${run}-4`, other.total_cents)).data).toMatchObject({ action: "review" });
    expect(await reload(other.id)).toMatchObject({ payment_status: "conferir", transaction_nsu: `nsu-${run}-3` });

    // A transaction of another order is not taken over.
    expect((await settle(row.id, `nsu-${run}-3`, row.total_cents)).data).toMatchObject({ action: "ignore" });
  });

  it("keeps made-to-order and fee a combinar on WhatsApp", async () => {
    const delivery = await newOrder(5, { fulfillment: "entrega", delivery_street: `Rua QA ${run}`, delivery_number: "1", delivery_district: "Centro" });
    const refused = await service!.rpc("begin_online_payment", { p_code: delivery.code, p_token: delivery.public_token });
    expect(refused.error?.code).toBe("CK045");
  });

  it("expires the link after its time and lets the customer open a new one", async () => {
    const row = await newOrder(6);
    await service!.rpc("begin_online_payment", { p_code: row.code, p_token: row.public_token });
    await service!.from("orders").update({ payment_valid_until: new Date(Date.now() - 60000).toISOString() }).eq("id", row.id);
    await service!.rpc("expire_orders");
    expect(await reload(row.id)).toMatchObject({ payment_status: "expirado", status: "novo" });

    const { error } = await service!.rpc("begin_online_payment", { p_code: row.code, p_token: row.public_token });
    expect(error).toBeNull();
    expect(await reload(row.id)).toMatchObject({ payment_status: "aguardando_pagamento" });
  });

  it("closes an unpaid link when the order is cancelled", async () => {
    const row = await newOrder(7);
    await service!.rpc("begin_online_payment", { p_code: row.code, p_token: row.public_token });
    const { error } = await admin.rpc("cancel_order", { p_order_id: row.id, p_from: "novo", p_reason: "QA" });
    expect(error).toBeNull();
    expect(await reload(row.id)).toMatchObject({ status: "cancelado", payment_status: "cancelado" });
    expect((await settle(row.id, `nsu-${run}-5`, row.total_cents)).data).toMatchObject({ action: "review" });
  });
});
