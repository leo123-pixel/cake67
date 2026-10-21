// Stage 11 acceptance through the real API: payment attempts and what the
// database decides when Stripe reports a payment. Stripe itself is not called:
// the server-only functions are run with the service role, as the webhook does.
// Uses a throwaway vitrine product and account alias, restores the stores'
// accounts and removes orders, product and users at the end.
import { existsSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { stockMismatches } from "./stock-invariant";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

type Client = SupabaseClient<Database>;
type Order = { code: string; token: string; id: string; subtotal: number };
type Begin = { payment_id: string; account: string; amount_cents: number; expires_at: string; stale_sessions: string[] };
type Outcome = { action: "ok" | "refund" | "review" | "duplicate" | "ignore"; payment_id?: string };

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = configured ? createClient<Database>(url!, serviceKey!, options) : null;
const anon = configured ? createClient<Database>(url!, anonKey!, options) : null;
const run = randomUUID().slice(0, 8);
const ACCOUNT = `qa${run.replace(/[^a-z0-9]/g, "")}`;
const users: string[] = [];
const codes: string[] = [];
const ids = { loja1: "", loja2: "", product: "" };
const originalAccounts = new Map<string, string | null>();
const PRICE = 2500;

let admin: Client;
let attendant1: Client;
let attendant2: Client;
let phoneSeq = 0;

async function signedInAs(role: "admin" | "atendente", storeId: string | null) {
  const email = `qa-pay-${role}-${storeId ? storeId.slice(0, 4) : "all"}-${run}@cake67.test`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await service!.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  await service!.from("staff").insert({ user_id: data.user.id, name: `QA pagamento ${role}`, role, store_id: storeId });
  const client = createClient<Database>(url!, anonKey!, options);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return client;
}

async function placeOrder(storeId = ids.loja1): Promise<Order> {
  phoneSeq += 1;
  const { data, error } = await anon!.rpc("create_order", {
    p_store_id: storeId,
    p_customer: {
      name: "QA pagamento",
      whatsapp: `6794${run.replace(/\D/g, "").padEnd(3, "5").slice(0, 3)}${String(phoneSeq).padStart(4, "0")}`,
      fulfillment: "retirada",
    },
    p_items: [{ product_id: ids.product, qty: 1 }],
  });
  if (error) throw error;
  const { code, token } = data as { code: string; token: string };
  codes.push(code);
  const { data: row } = await service!.from("orders").select("id, subtotal_cents").eq("code", code).single();
  return { code, token, id: row!.id, subtotal: row!.subtotal_cents };
}

async function begin(order: Order, sessionId?: string) {
  const { data, error } = await service!.rpc("begin_order_payment", { p_code: order.code, p_token: order.token });
  if (error) throw error;
  const result = data as unknown as Begin;
  if (sessionId) {
    const { error: attachError } = await service!.rpc("attach_payment_session", {
      p_payment_id: result.payment_id,
      p_session_id: sessionId,
    });
    if (attachError) throw attachError;
  }
  return result;
}

async function settle(sessionId: string, amount: number, { account = ACCOUNT, currency = "brl", method = "pix" } = {}) {
  const { data, error } = await service!.rpc("settle_order_payment", {
    p_account: account,
    p_session_id: sessionId,
    p_payment_intent_id: `pi_${sessionId}`,
    p_amount_cents: amount,
    p_currency: currency,
    p_method: method,
  });
  if (error) throw error;
  return data as unknown as Outcome;
}

async function markRefund(paymentId: string | null, status: string, total: number | null, account = ACCOUNT, intent: string | null = null) {
  const { data, error } = await service!.rpc("mark_refund", {
    p_account: account,
    p_payment_id: paymentId,
    p_payment_intent_id: intent,
    p_refund_id: `re_${randomUUID().slice(0, 8)}`,
    p_refund_status: status,
    p_total_refunded_cents: total,
  });
  if (error) throw error;
  return data as unknown as Outcome;
}

async function order(id: string) {
  const { data } = await service!.from("orders").select("status, payment_status, expires_at").eq("id", id).single();
  return data!;
}

async function attempt(sessionId: string) {
  const { data } = await service!.from("order_payments").select("*").eq("session_id", sessionId).single();
  return data!;
}

async function quantity() {
  const { data } = await service!.from("stock").select("quantity").eq("product_id", ids.product).eq("store_id", ids.loja1).single();
  return data!.quantity;
}

async function setStock(qty: number, storeId = ids.loja1) {
  const { error } = await admin.rpc("set_stock", { p_product_id: ids.product, p_store_id: storeId, p_quantity: qty });
  if (error) throw error;
}

async function expire(orderId: string) {
  await service!.from("orders").update({ expires_at: new Date(Date.now() - 60000).toISOString() }).eq("id", orderId);
  await service!.rpc("expire_orders");
}

beforeAll(async () => {
  if (!configured) return;
  const [{ data: stores }, { data: category }] = await Promise.all([
    service!.from("stores").select("id, slug, payment_account"),
    service!.from("categories").select("id").eq("kind", "vitrine").limit(1).single(),
  ]);
  const loja1 = stores!.find((s) => s.slug === "estiva")!;
  const loja2 = stores!.find((s) => s.slug === "afonso-pena")!;
  ids.loja1 = loja1.id;
  ids.loja2 = loja2.id;
  originalAccounts.set(loja1.id, loja1.payment_account);
  originalAccounts.set(loja2.id, loja2.payment_account);
  await service!.from("stores").update({ payment_account: ACCOUNT }).eq("id", loja1.id);
  await service!.from("stores").update({ payment_account: null }).eq("id", loja2.id);

  const { data: product, error } = await service!
    .from("products")
    .insert({
      slug: `qa-pagamento-${run}`,
      name: `QA Pagamento ${run}`,
      category_id: category!.id,
      type: "vitrine",
      price_cents: PRICE,
    })
    .select("id")
    .single();
  if (error) throw error;
  ids.product = product.id;

  admin = await signedInAs("admin", null);
  attendant1 = await signedInAs("atendente", ids.loja1);
  attendant2 = await signedInAs("atendente", ids.loja2);
  await setStock(20);
  await setStock(5, ids.loja2);
});

afterAll(async () => {
  if (!configured) return;
  for (const [storeId, account] of originalAccounts) {
    await service!.from("stores").update({ payment_account: account }).eq("id", storeId);
  }
  if (codes.length) {
    // Paid orders no longer expire on their own: expire everything still open
    // (returns stock), then remove the orders (their payments go with them).
    await service!.from("orders").update({ expires_at: new Date(Date.now() - 60000).toISOString() }).in("code", codes).eq("status", "novo");
    await service!.rpc("expire_orders");
    await service!.from("orders").delete().in("code", codes);
  }
  if (ids.product) await service!.from("products").delete().eq("id", ids.product);
  for (const id of users) await service!.auth.admin.deleteUser(id);
});

describe.skipIf(!configured)("online payment", () => {
  it("only the server reaches payments: not anon, not staff", async () => {
    const o = await placeOrder();
    const anonBegin = await anon!.rpc("begin_order_payment", { p_code: o.code, p_token: o.token });
    expect(anonBegin.error?.code).toBe("42501");
    const staffSettle = await admin.rpc("settle_order_payment", {
      p_account: ACCOUNT,
      p_session_id: "cs_x",
      p_payment_intent_id: "pi_x",
      p_amount_cents: 100,
      p_currency: "brl",
      p_method: "pix",
    });
    expect(staffSettle.error?.code).toBe("42501");
    const anonRead = await anon!.from("order_payments").select("id").limit(1);
    expect(anonRead.data ?? []).toHaveLength(0);
  });

  it("opening a payment checks the order and stretches the reservation over the session", async () => {
    const o = await placeOrder();
    const wrong = await service!.rpc("begin_order_payment", { p_code: o.code, p_token: "wrong" });
    expect(wrong.error?.code).toBe("P0002");

    const first = await begin(o, `cs_${run}_open1`);
    expect(first).toMatchObject({ account: ACCOUNT, amount_cents: o.subtotal });
    expect(new Date(first.expires_at).getTime()).toBeGreaterThanOrEqual(Date.now() + 29 * 60_000);
    const after = await order(o.id);
    expect(after.payment_status).toBe("pagando");
    expect(new Date(after.expires_at!).getTime()).toBe(new Date(first.expires_at).getTime() + 5 * 60_000);

    const second = await begin(o);
    expect(second.stale_sessions).toEqual([`cs_${run}_open1`]);
    expect((await attempt(`cs_${run}_open1`)).status).toBe("cancelado");

    const { error: failError } = await service!.rpc("fail_payment_attempt", { p_payment_id: second.payment_id });
    expect(failError).toBeNull();
    expect((await order(o.id)).payment_status).toBe("nenhum");

    await begin(o);
    await begin(o);
    await begin(o);
    const sixth = await service!.rpc("begin_order_payment", { p_code: o.code, p_token: o.token });
    expect(sixth.error?.code).toBe("CK043");
    const { data: pub } = await anon!.rpc("get_order_public", { p_code: o.code, p_token: o.token });
    expect((pub as { payment: { attempts_left: number } }).payment.attempts_left).toBe(0);
  });

  it("a store without account only takes WhatsApp", async () => {
    const o = await placeOrder(ids.loja2);
    const { error } = await service!.rpc("begin_order_payment", { p_code: o.code, p_token: o.token });
    expect(error?.code).toBe("CK042");
    const { data: pub } = await anon!.rpc("get_order_public", { p_code: o.code, p_token: o.token });
    expect((pub as { payment: { store_has_account: boolean } }).payment.store_has_account).toBe(false);
  });

  it("a payment marks the order paid, stops its expiry, once, and only for its account", async () => {
    const o = await placeOrder();
    const session = `cs_${run}_paid`;
    await begin(o, session);

    expect((await settle(session, o.subtotal, { account: "outraconta" })).action).toBe("ignore");
    expect((await settle(`cs_${run}_unknown`, o.subtotal)).action).toBe("ignore");

    expect((await settle(session, o.subtotal)).action).toBe("ok");
    expect(await order(o.id)).toEqual({ status: "novo", payment_status: "pago", expires_at: null });
    expect((await attempt(session)).method).toBe("pix");
    expect((await settle(session, o.subtotal)).action).toBe("duplicate");

    const again = await service!.rpc("begin_order_payment", { p_code: o.code, p_token: o.token });
    expect(again.error?.code).toBe("CK041");
    const { data: pub } = await anon!.rpc("get_order_public", { p_code: o.code, p_token: o.token });
    expect((pub as { payment: unknown }).payment).toMatchObject({ status: "pago", method: "pix" });

    await service!.rpc("expire_orders");
    expect((await order(o.id)).status).toBe("novo");

    const own = await attendant1.from("order_payments").select("id").eq("order_id", o.id);
    expect(own.data).toHaveLength(1);
    const other = await attendant2.from("order_payments").select("id").eq("order_id", o.id);
    expect(other.data).toEqual([]);
    await attendant1.from("orders").update({ payment_status: "nenhum" }).eq("id", o.id);
    expect((await order(o.id)).payment_status).toBe("pago");

    // Cancelling it in the panel marks the payment for refund (spec D11).
    const { error: cancelError } = await attendant1.rpc("cancel_order", { p_order_id: o.id, p_from: "novo", p_reason: "Teste" });
    expect(cancelError).toBeNull();
    expect(await attempt(session)).toMatchObject({ status: "devolvendo", note: "Pedido cancelado" });
    expect((await order(o.id)).payment_status).toBe("devolvendo");
    const paymentId = (await attempt(session)).id;
    expect((await markRefund(paymentId, "succeeded", o.subtotal)).action).toBe("ok");
    expect((await order(o.id)).payment_status).toBe("devolvido");
  });

  it("a different amount goes to review and keeps the reservation", async () => {
    const o = await placeOrder();
    const session = `cs_${run}_review`;
    await begin(o, session);
    expect((await settle(session, o.subtotal - 1, { method: "card" })).action).toBe("review");
    expect(await order(o.id)).toMatchObject({ payment_status: "conferir", expires_at: null });
    expect((await settle(session, o.subtotal, { currency: "usd" })).action).toBe("duplicate");
  });

  it("a second paid tab is refunded; the refund is asked again until Stripe was called", async () => {
    const o = await placeOrder();
    const tab1 = `cs_${run}_tab1`;
    const tab2 = `cs_${run}_tab2`;
    await begin(o, tab1);
    await begin(o, tab2);
    expect((await settle(tab2, o.subtotal, { method: "card" })).action).toBe("ok");
    const duplicate = await settle(tab1, o.subtotal, { method: "card" });
    expect(duplicate.action).toBe("refund");
    expect((await attempt(tab1)).note).toBe("Pagamento em duplicidade");
    expect((await settle(tab1, o.subtotal, { method: "card" })).action).toBe("refund");

    await markRefund(duplicate.payment_id!, "succeeded", o.subtotal);
    expect((await attempt(tab1)).status).toBe("devolvido");
    expect((await order(o.id)).payment_status).toBe("pago");
  });

  it("a payment after cancelling is refunded; failed refunds can be retried", async () => {
    const o = await placeOrder();
    const session = `cs_${run}_cancel`;
    await begin(o, session);
    const { error } = await attendant1.rpc("cancel_order", { p_order_id: o.id, p_from: "novo", p_reason: "Teste" });
    expect(error).toBeNull();
    expect((await attempt(session)).status).toBe("cancelado");

    const outcome = await settle(session, o.subtotal);
    expect(outcome.action).toBe("refund");
    expect((await order(o.id)).payment_status).toBe("devolvendo");

    await markRefund(outcome.payment_id!, "pending", null);
    expect((await attempt(session)).refund_id).not.toBeNull();
    await markRefund(null, "failed", null, ACCOUNT, `pi_${session}`);
    expect((await order(o.id)).payment_status).toBe("falha_devolucao");
    expect((await markRefund(outcome.payment_id!, "succeeded", o.subtotal, "outraconta")).action).toBe("ignore");
    await markRefund(outcome.payment_id!, "succeeded", o.subtotal);
    expect((await order(o.id)).payment_status).toBe("devolvido");
  });

  it("a late payment reserves an expired order again, or is refunded without stock", async () => {
    const withStock = await placeOrder();
    const late = `cs_${run}_late`;
    await begin(withStock, late);
    await expire(withStock.id);
    expect((await order(withStock.id)).status).toBe("expirado");
    const before = await quantity();
    expect((await settle(late, withStock.subtotal)).action).toBe("ok");
    expect(await order(withStock.id)).toMatchObject({ status: "novo", payment_status: "pago" });
    expect(await quantity()).toBe(before - 1);
    const { data: moves } = await service!
      .from("stock_movements")
      .select("reason")
      .eq("order_id", withStock.id)
      .order("id", { ascending: false })
      .limit(1);
    expect(moves).toEqual([{ reason: "reserva" }]);

    const noStock = await placeOrder();
    const late2 = `cs_${run}_late2`;
    await begin(noStock, late2);
    await expire(noStock.id);
    await setStock(0);
    const outcome = await settle(late2, noStock.subtotal);
    await setStock(20);
    expect(outcome.action).toBe("refund");
    expect((await order(noStock.id)).status).toBe("expirado");
    expect((await attempt(late2)).note).toBe("Reserva expirada sem estoque");
  });

  it("an expired session closes the attempt", async () => {
    const o = await placeOrder();
    const session = `cs_${run}_exp`;
    await begin(o, session);
    const close = (status: "expirado" | "pago") =>
      service!.rpc("close_payment_attempt", { p_account: ACCOUNT, p_session_id: session, p_status: status });
    expect(((await close("expirado")).data as unknown as Outcome).action).toBe("ok");
    expect((await order(o.id)).payment_status).toBe("nenhum");
    expect(((await close("expirado")).data as unknown as Outcome).action).toBe("duplicate");
    expect((await close("pago")).error?.code).toBe("CK011");
  });

  it("reactivation still works and the report counts what was paid online", async () => {
    const o = await placeOrder();
    await expire(o.id);
    const before = await quantity();
    const { error } = await admin.rpc("reactivate_order", { p_order_id: o.id });
    expect(error).toBeNull();
    expect((await order(o.id)).status).toBe("confirmado");
    expect(await quantity()).toBe(before - 1);

    const paid = await placeOrder();
    await begin(paid, `cs_${run}_report`);
    await settle(`cs_${run}_report`, paid.subtotal);
    const { error: confirmError } = await admin.rpc("advance_order", { p_order_id: paid.id, p_from: "novo", p_to: "confirmado" });
    expect(confirmError).toBeNull();

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Campo_Grande" }).format(new Date());
    const { data } = await admin.rpc("report_summary", { p_from: today, p_to: today, p_store_id: ids.loja1 });
    expect((data as { totals: { online_cents: number } }).totals.online_cents).toBeGreaterThanOrEqual(paid.subtotal);
  });

  // T16: the panel (orders-live) refreshes on any change it hears and rings
  // only on INSERT of a new order; a payment arrives as an UPDATE.
  it("the panel hears the payment in real time as an update", async () => {
    const { data: session } = await attendant1.auth.getSession();
    await attendant1.realtime.setAuth(session.session!.access_token);

    const heard: { type: string; id: string; payment_status: string }[] = [];
    const channel = attendant1.channel(`pay-${run}`).on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
      const row = payload.new as { id?: string; payment_status?: string };
      if (row.id) heard.push({ type: payload.eventType, id: row.id, payment_status: row.payment_status ?? "" });
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
    // Same wait as the stage 05 test: streaming starts shortly after SUBSCRIBED.
    await new Promise((r) => setTimeout(r, 2000));

    const waitFor = async (check: () => boolean, ms: number) => {
      const deadline = Date.now() + ms;
      while (!check() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));
      return check();
    };
    const mine = () => heard.filter((e) => e.id === o.id);

    const o = await placeOrder();
    // Realtime may take several seconds after SUBSCRIBED to start streaming
    // (it missed this INSERT in a run). Touch the test order until an update
    // is heard, so a missed payment is never a subscription not ready yet.
    let probe = 0;
    const streaming = await waitFor(() => {
      if (mine().length > 0) return true;
      probe += 1;
      if (probe % 4 === 1) void service!.from("orders").update({ notes: `probe ${probe}` }).eq("id", o.id).then(() => undefined);
      return false;
    }, 20000);
    const before = mine().length;
    const session_ = `cs_${run}_live`;
    await begin(o, session_);
    await settle(session_, o.subtotal);
    await waitFor(() => mine().some((e) => e.payment_status === "pago"), 15000);
    await attendant1.removeChannel(channel);

    const events = JSON.stringify(mine());
    expect(streaming, `Realtime never streamed: ${events}`).toBe(true);
    const paid = mine().slice(before).find((e) => e.payment_status === "pago");
    expect(paid?.type, `events heard: ${events}`).toBe("UPDATE");
  }, 60000);

  it("movements still sum to the quantity for every stock row", async () => {
    expect(await stockMismatches(service!)).toEqual([]);
  });
});
