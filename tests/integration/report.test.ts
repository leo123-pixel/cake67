// Stage 06 acceptance through the real API: report_summary totals match a
// hand count for orders moved to a fixed past day, and only admins run it.
// Removes its orders and users; stock goes back through set_stock.
import { existsSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import type { Report } from "@/lib/report";

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
const codes: string[] = [];
const ids = { loja1: "", loja2: "", product: "" };
const stockBefore = new Map<string, number>();
const DAY = "2020-02-10";

let admin: Client;
let attendant: Client;
let phoneSeq = 0;

async function signedInAs(role: "admin" | "atendente", storeId: string | null) {
  const email = `qa-report-${role}-${run}@cake67.test`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await service!.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  await service!.from("staff").insert({ user_id: data.user.id, name: `QA ${role}`, role, store_id: storeId });
  const client = createClient<Database>(url!, anonKey!, options);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return client;
}

// Places an order and moves it to a Campo Grande local time on a past day.
async function placeOrder(storeId: string, qty: number, localTime: string) {
  phoneSeq += 1;
  const whatsapp = `6792${run.replace(/\D/g, "").padEnd(3, "4").slice(0, 3)}${String(phoneSeq).padStart(4, "0")}`;
  const { data, error } = await anon!.rpc("create_order", {
    p_store_id: storeId,
    p_customer: { name: "QA relatório", whatsapp, fulfillment: "retirada" },
    p_items: [{ product_id: ids.product, qty }],
  });
  if (error) throw error;
  const { code } = data as { code: string };
  codes.push(code);
  const { data: row } = await service!
    .from("orders")
    .update({ created_at: new Date(`${localTime}:00-04:00`).toISOString() })
    .eq("code", code)
    .select("id, subtotal_cents")
    .single();
  return { code, id: row!.id, subtotal: row!.subtotal_cents };
}

async function advance(id: string, steps: Database["public"]["Enums"]["order_status"][]) {
  for (let i = 1; i < steps.length; i++) {
    const { error } = await admin.rpc("advance_order", { p_order_id: id, p_from: steps[i - 1], p_to: steps[i] });
    if (error) throw error;
  }
}

beforeAll(async () => {
  if (!configured) return;
  const [{ data: stores }, { data: product }] = await Promise.all([
    service!.from("stores").select("id, slug"),
    service!.from("products").select("id").eq("slug", "crunch-cake").single(),
  ]);
  ids.loja1 = stores!.find((s) => s.slug === "estiva")!.id;
  ids.loja2 = stores!.find((s) => s.slug === "afonso-pena")!.id;
  ids.product = product!.id;
  const { data: stock } = await service!.from("stock").select("store_id, quantity").eq("product_id", ids.product);
  for (const row of stock!) stockBefore.set(row.store_id, row.quantity);
  admin = await signedInAs("admin", null);
  attendant = await signedInAs("atendente", ids.loja2);
});

afterAll(async () => {
  if (!configured) return;
  if (codes.length) {
    await service!.from("orders").update({ expires_at: new Date(Date.now() - 60000).toISOString() }).in("code", codes).eq("status", "novo");
    await service!.rpc("expire_orders");
    // Delivered/confirmed orders consumed stock: put it back with a logged adjustment.
    for (const [storeId, quantity] of stockBefore) {
      await admin.rpc("set_stock", { p_product_id: ids.product, p_store_id: storeId, p_quantity: quantity });
    }
    await service!.from("orders").delete().in("code", codes);
  }
  for (const id of users) await service!.auth.admin.deleteUser(id);
});

describe.skipIf(!configured)("report", () => {
  it("totals, stores and top products match a hand count", async () => {
    const delivered = await placeOrder(ids.loja1, 2, `${DAY}T12:00`);
    const confirmedLate = await placeOrder(ids.loja2, 1, `${DAY}T23:30`);
    const cancelled = await placeOrder(ids.loja1, 1, `${DAY}T10:00`);
    const expired = await placeOrder(ids.loja2, 1, `${DAY}T09:00`);
    await placeOrder(ids.loja1, 1, "2020-02-11T00:10");

    await advance(delivered.id, ["novo", "confirmado", "pronto", "entregue"]);
    await advance(confirmedLate.id, ["novo", "confirmado"]);
    const { error: cancelError } = await admin.rpc("cancel_order", { p_order_id: cancelled.id, p_from: "novo", p_reason: "Teste" });
    expect(cancelError).toBeNull();
    await service!.from("orders").update({ expires_at: new Date(Date.now() - 60000).toISOString() }).eq("id", expired.id);
    await service!.rpc("expire_orders");

    const { data, error } = await admin.rpc("report_summary", { p_from: DAY, p_to: DAY });
    expect(error).toBeNull();
    const report = data as unknown as Report;
    const revenue = delivered.subtotal + confirmedLate.subtotal;

    expect(report.totals).toEqual({
      orders: 2,
      revenue_cents: revenue,
      avg_ticket_cents: Math.round(revenue / 2),
      cancelled: { count: 1, cents: cancelled.subtotal },
      expired: { count: 1, cents: expired.subtotal },
      pending: { count: 0, cents: 0 },
    });
    expect(report.by_day).toEqual([{ day: DAY, orders: 2, revenue_cents: revenue }]);
    expect(report.by_store.map((s) => [s.store_id, s.orders, s.revenue_cents])).toEqual([
      [ids.loja1, 1, delivered.subtotal],
      [ids.loja2, 1, confirmedLate.subtotal],
    ]);
    expect(report.top_products).toEqual([
      expect.objectContaining({ product_id: ids.product, units: 3, kg: null, revenue_cents: revenue }),
    ]);

    const { data: loja2 } = await admin.rpc("report_summary", { p_from: DAY, p_to: DAY, p_store_id: ids.loja2 });
    expect((loja2 as unknown as Report).totals).toMatchObject({ orders: 1, revenue_cents: confirmedLate.subtotal });
  }, 60000);

  it("attendants and anon cannot run the report", async () => {
    const { error } = await attendant.rpc("report_summary", { p_from: DAY, p_to: DAY });
    expect(error?.code).toBe("42501");
    const { error: anonError } = await anon!.rpc("report_summary", { p_from: DAY, p_to: DAY });
    expect(anonError).not.toBeNull();
  });

  it("attendants cannot change settings", async () => {
    const { data } = await attendant.from("settings").update({ reservation_minutes: 60 }).eq("id", 1).select("id");
    expect(data).toEqual([]);
  });
});
