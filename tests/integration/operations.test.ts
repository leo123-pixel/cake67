// Stage 05 acceptance through the real API: concurrent transitions, store
// isolation (tables, functions and Realtime) and stock on cancel. Removes the
// orders and users it creates; stock returns through cancel/expiration.
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
const codes: string[] = [];
const ids = { loja1: "", loja2: "", product: "" };

let admin: Client;
let attendant: Client;
let phoneSeq = 0;

async function signedInAs(role: "admin" | "atendente", storeId: string | null) {
  const email = `qa-ops-${role}-${run}@cake67.test`;
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

async function placeOrder(storeId: string) {
  phoneSeq += 1;
  const whatsapp = `6791${run.replace(/\D/g, "").padEnd(3, "3").slice(0, 3)}${String(phoneSeq).padStart(4, "0")}`;
  const { data, error } = await anon!.rpc("create_order", {
    p_store_id: storeId,
    p_customer: { name: "QA operação", whatsapp, fulfillment: "retirada" },
    p_items: [{ product_id: ids.product, qty: 1 }],
  });
  if (error) throw error;
  const { code } = data as { code: string };
  codes.push(code);
  const { data: row } = await service!.from("orders").select("id").eq("code", code).single();
  return { code, id: row!.id };
}

async function quantity(storeId: string) {
  const { data } = await service!.from("stock").select("quantity").eq("product_id", ids.product).eq("store_id", storeId).single();
  return data!.quantity;
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
  admin = await signedInAs("admin", null);
  attendant = await signedInAs("atendente", ids.loja2);
});

afterAll(async () => {
  if (!configured) return;
  if (codes.length) {
    await service!.from("orders").update({ expires_at: new Date(Date.now() - 60000).toISOString() }).in("code", codes).eq("status", "novo");
    await service!.rpc("expire_orders");
    await service!.from("orders").delete().in("code", codes);
  }
  for (const id of users) await service!.auth.admin.deleteUser(id);
});

describe.skipIf(!configured)("order operations", () => {
  let o1: { code: string; id: string };

  it("two simultaneous confirmations: one wins, the other sees the change", async () => {
    o1 = await placeOrder(ids.loja2);
    const results = await Promise.all([
      admin.rpc("advance_order", { p_order_id: o1.id, p_from: "novo", p_to: "confirmado" }),
      attendant.rpc("advance_order", { p_order_id: o1.id, p_from: "novo", p_to: "confirmado" }),
    ]);
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(results.filter((r) => r.error).map((r) => r.error?.code)).toEqual(["CK020"]);

    const { data: moves } = await service!.from("stock_movements").select("reason").eq("order_id", o1.id);
    expect(moves!.map((m) => m.reason)).toEqual(["venda"]);
  });

  it("attendant of Loja 2 cannot see nor change a Loja 1 order", async () => {
    const o2 = await placeOrder(ids.loja1);
    const { data: orders } = await attendant.from("orders").select("id").eq("id", o2.id);
    expect(orders).toEqual([]);
    const { data: events } = await attendant.from("order_events").select("id").eq("order_id", o2.id);
    expect(events).toEqual([]);
    const { error } = await attendant.rpc("advance_order", { p_order_id: o2.id, p_from: "novo", p_to: "confirmado" });
    expect(error?.code).toBe("42501");
    // No update policy any more: a direct update changes nothing.
    await attendant.from("orders").update({ status: "entregue" }).eq("id", o2.id);
    const { data: after } = await service!.from("orders").select("status").eq("id", o2.id).single();
    expect(after!.status).toBe("novo");
  });

  it("cancelling returns the stock and logs the reason", async () => {
    const before = await quantity(ids.loja2);
    const { error } = await attendant.rpc("cancel_order", { p_order_id: o1.id, p_from: "confirmado", p_reason: "Cliente desistiu" });
    expect(error).toBeNull();
    expect(await quantity(ids.loja2)).toBe(before + 1);
    const { data: events } = await attendant.from("order_events").select("to_status, actor_name, note").eq("order_id", o1.id).order("id");
    expect(events!.map((e) => e.to_status)).toEqual(["novo", "confirmado", "cancelado"]);
    expect(events!.at(-1)).toMatchObject({ actor_name: "QA atendente", note: "Cliente desistiu" });
  });

  it("Realtime delivers only the attendant's store orders", async () => {
    const { data: session } = await attendant.auth.getSession();
    await attendant.realtime.setAuth(session.session!.access_token);

    const received: string[] = [];
    const channel = attendant
      .channel(`ops-${run}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        received.push((payload.new as { code: string }).code);
      });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Realtime did not subscribe")), 10000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    // Realtime acknowledges the subscription slightly before it starts
    // streaming database changes; the panel stays connected, a test must wait.
    await new Promise((r) => setTimeout(r, 2000));

    const other = await placeOrder(ids.loja1);
    const mine = await placeOrder(ids.loja2);
    const deadline = Date.now() + 10000;
    while (!received.includes(mine.code) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));
    await new Promise((r) => setTimeout(r, 2000)); // grace period for a wrongly delivered event

    await attendant.removeChannel(channel);
    expect(received).toContain(mine.code);
    expect(received).not.toContain(other.code);
  }, 30000);

  it("movements still sum to the quantity for every stock row", async () => {
    const [{ data: stock }, { data: movements }] = await Promise.all([
      service!.from("stock").select("product_id, store_id, quantity"),
      service!.from("stock_movements").select("product_id, store_id, delta").limit(100000),
    ]);
    const sums = new Map<string, number>();
    for (const m of movements!) sums.set(`${m.product_id}:${m.store_id}`, (sums.get(`${m.product_id}:${m.store_id}`) ?? 0) + m.delta);
    expect(stock!.filter((r) => (sums.get(`${r.product_id}:${r.store_id}`) ?? 0) !== r.quantity)).toEqual([]);
  });
});
