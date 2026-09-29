// Stage 10 acceptance through the real API: weighed pieces in the showcase.
// Creates a throwaway vitrine_kg product (pieces and movements go with it),
// orders and users, and removes them all at the end.
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
const PRICE_PER_KG = 11000;

let admin: Client;
let attendant: Client;
let phoneSeq = 0;

async function signedInAs(role: "admin" | "atendente", storeId: string | null) {
  const email = `qa-pieces-${role}-${run}@cake67.test`;
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

function nextPhone() {
  phoneSeq += 1;
  return `6792${run.replace(/\D/g, "").padEnd(3, "7").slice(0, 3)}${String(phoneSeq).padStart(4, "0")}`;
}

function orderPieces(storeId: string, pieceIds: string[]) {
  return anon!.rpc("create_order", {
    p_store_id: storeId,
    p_customer: { name: "QA peça", whatsapp: nextPhone(), fulfillment: "retirada" },
    p_items: pieceIds.map((piece_id) => ({ product_id: ids.product, qty: 1, piece_id })),
  });
}

async function placeOrder(pieceId: string) {
  const { data, error } = await orderPieces(ids.loja1, [pieceId]);
  if (error) throw error;
  const { code } = data as { code: string };
  codes.push(code);
  const { data: row } = await service!.from("orders").select("id, has_made_to_order, subtotal_cents").eq("code", code).single();
  return { code, ...row! };
}

async function addPiece(weightG: number, storeId = ids.loja1) {
  const { data, error } = await admin.rpc("add_piece", { p_product_id: ids.product, p_store_id: storeId, p_weight_g: weightG });
  if (error) throw error;
  return data;
}

async function piece(id: string) {
  const { data } = await service!.from("showcase_pieces").select("status, order_id, weight_g").eq("id", id).single();
  return data!;
}

async function expire(orderId: string) {
  await service!.from("orders").update({ expires_at: new Date(Date.now() - 60000).toISOString() }).eq("id", orderId);
  await service!.rpc("expire_orders");
}

beforeAll(async () => {
  if (!configured) return;
  const [{ data: stores }, { data: category }] = await Promise.all([
    service!.from("stores").select("id, slug"),
    service!.from("categories").select("id").eq("kind", "vitrine").limit(1).single(),
  ]);
  ids.loja1 = stores!.find((s) => s.slug === "estiva")!.id;
  ids.loja2 = stores!.find((s) => s.slug === "afonso-pena")!.id;
  const { data: product, error } = await service!
    .from("products")
    .insert({
      slug: `qa-bolo-inteiro-${run}`,
      name: `QA Bolo inteiro ${run}`,
      category_id: category!.id,
      type: "vitrine_kg",
      price_cents: PRICE_PER_KG,
    })
    .select("id")
    .single();
  if (error) throw error;
  ids.product = product.id;
  admin = await signedInAs("admin", null);
  attendant = await signedInAs("atendente", ids.loja2);
});

afterAll(async () => {
  if (!configured) return;
  if (codes.length) await service!.from("orders").delete().in("code", codes);
  if (ids.product) await service!.from("products").delete().eq("id", ids.product);
  for (const id of users) await service!.auth.admin.deleteUser(id);
});

describe.skipIf(!configured)("weighed pieces", () => {
  it("panel: adds pieces within the weight range and logs the entry", async () => {
    const id = await addPiece(1340);
    expect(await piece(id)).toMatchObject({ status: "disponivel", weight_g: 1340 });

    const { data: moves } = await service!.from("stock_movements").select("reason, delta, weight_g, quantity_after").eq("piece_id", id);
    expect(moves).toEqual([{ reason: "ajuste", delta: 1, weight_g: 1340, quantity_after: 1 }]);

    for (const weight of [299, 10001]) {
      const { error } = await admin.rpc("add_piece", { p_product_id: ids.product, p_store_id: ids.loja1, p_weight_g: weight });
      expect(error?.code).toBe("CK031");
    }
  });

  it("attendants only manage pieces of their own store", async () => {
    const other = await attendant.rpc("add_piece", { p_product_id: ids.product, p_store_id: ids.loja1, p_weight_g: 1000 });
    expect(other.error?.code).toBe("42501");

    const loja1Piece = await addPiece(1100);
    const sell = await attendant.rpc("sell_piece", { p_piece_id: loja1Piece });
    expect(sell.error?.code).toBe("42501");

    const own = await attendant.rpc("add_piece", { p_product_id: ids.product, p_store_id: ids.loja2, p_weight_g: 1000 });
    expect(own.error).toBeNull();

    const { data: visible } = await attendant.from("showcase_pieces").select("store_id").eq("product_id", ids.product);
    expect(new Set(visible!.map((p) => p.store_id))).toEqual(new Set([ids.loja2]));
  });

  it("anon sees only available pieces through the view, never the table or the functions", async () => {
    const available = await addPiece(900);
    const sold = await addPiece(950);
    await admin.rpc("sell_piece", { p_piece_id: sold });

    const { data: view } = await anon!.from("piece_availability").select("id").eq("product_id", ids.product);
    const viewIds = view!.map((p) => p.id);
    expect(viewIds).toContain(available);
    expect(viewIds).not.toContain(sold);

    const { data: table } = await anon!.from("showcase_pieces").select("id").limit(1);
    expect(table ?? []).toHaveLength(0);

    const { error } = await anon!.rpc("add_piece", { p_product_id: ids.product, p_store_id: ids.loja1, p_weight_g: 1000 });
    expect(error).not.toBeNull();
  });

  it("quotes and orders at price per kg × weight, without schedule", async () => {
    const id = await addPiece(1340);
    const { data: quote } = await anon!.rpc("quote_order", {
      p_store_id: ids.loja1,
      p_items: [{ product_id: ids.product, qty: 1, piece_id: id }],
    });
    const line = (quote as { lines: { total_cents: number; problem: string | null }[] }).lines[0]!;
    expect(line).toMatchObject({ total_cents: 14740, problem: null });

    const order = await placeOrder(id);
    expect(order).toMatchObject({ has_made_to_order: false, subtotal_cents: 14740 });
    expect(await piece(id)).toMatchObject({ status: "reservado", order_id: order.id });

    const { data: item } = await service!.from("order_items").select("piece_id, options").eq("order_id", order.id).single();
    expect(item).toMatchObject({ piece_id: id, options: { piece_id: id, weight_g: 1340 } });

    const { data: gone } = await anon!.from("piece_availability").select("id").eq("id", id);
    expect(gone).toHaveLength(0);
  });

  it("two orders for the same piece: only one gets it", async () => {
    const id = await addPiece(1620);
    const results = await Promise.all([orderPieces(ids.loja1, [id]), orderPieces(ids.loja1, [id])]);
    for (const r of results) if (!r.error) codes.push((r.data as { code: string }).code);
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(results.find((r) => r.error)?.error?.code).toBe("CK010");

    const { data: quote } = await anon!.rpc("quote_order", {
      p_store_id: ids.loja1,
      p_items: [{ product_id: ids.product, qty: 1, piece_id: id }],
    });
    expect((quote as { lines: { problem: string; problem_text: string }[] }).lines[0]).toMatchObject({
      problem: "esgotado",
      problem_text: "Esse bolo acabou de ser reservado, escolha outro peso",
    });
  });

  it("refuses the same piece twice and a piece from another store", async () => {
    const id = await addPiece(1200);
    const twice = await orderPieces(ids.loja1, [id, id]);
    expect(twice.error?.code).toBe("CK015");

    const loja2Piece = await addPiece(1200, ids.loja2);
    const wrongStore = await orderPieces(ids.loja1, [loja2Piece]);
    expect(wrongStore.error?.code).toBe("CK015");
    expect(await piece(id)).toMatchObject({ status: "disponivel" });
  });

  it("expiration and cancellation return the piece", async () => {
    const a = await addPiece(1000);
    const expiring = await placeOrder(a);
    await expire(expiring.id);
    expect(await piece(a)).toMatchObject({ status: "disponivel", order_id: null });

    const b = await addPiece(1050);
    const cancelling = await placeOrder(b);
    const { error } = await admin.rpc("cancel_order", { p_order_id: cancelling.id, p_from: "novo", p_reason: "QA" });
    expect(error).toBeNull();
    expect(await piece(b)).toMatchObject({ status: "disponivel", order_id: null });

    const { data: moves } = await service!.from("stock_movements").select("reason, delta").eq("piece_id", b).order("id");
    expect(moves!.map((m) => [m.reason, m.delta])).toEqual([["ajuste", 1], ["reserva", -1], ["devolucao", 1]]);
  });

  it("reactivation reserves again, or fails when the piece was sold at the counter", async () => {
    const a = await addPiece(1400);
    const first = await placeOrder(a);
    await expire(first.id);
    const ok = await admin.rpc("reactivate_order", { p_order_id: first.id });
    expect(ok.error).toBeNull();
    expect(await piece(a)).toMatchObject({ status: "reservado", order_id: first.id });

    const b = await addPiece(1450);
    const second = await placeOrder(b);
    await expire(second.id);
    await admin.rpc("sell_piece", { p_piece_id: b });
    const fail = await admin.rpc("reactivate_order", { p_order_id: second.id });
    expect(fail.error?.code).toBe("CK010");
    const { data: order } = await service!.from("orders").select("status").eq("id", second.id).single();
    expect(order!.status).toBe("expirado");
  });

  it("delivering the order marks the piece sold", async () => {
    const id = await addPiece(1500);
    const order = await placeOrder(id);
    await admin.rpc("advance_order", { p_order_id: order.id, p_from: "novo", p_to: "confirmado" });
    const { error } = await admin.rpc("advance_order", { p_order_id: order.id, p_from: "confirmado", p_to: "entregue" });
    expect(error).toBeNull();
    expect(await piece(id)).toMatchObject({ status: "vendido", order_id: order.id });
  });

  it("panel actions only touch available pieces", async () => {
    const reserved = await addPiece(1600);
    await placeOrder(reserved);
    for (const call of [
      admin.rpc("sell_piece", { p_piece_id: reserved }),
      admin.rpc("discard_piece", { p_piece_id: reserved }),
      admin.rpc("set_piece_weight", { p_piece_id: reserved, p_weight_g: 1000 }),
    ]) {
      expect((await call).error?.code).toBe("CK030");
    }

    const id = await addPiece(1340);
    expect((await admin.rpc("set_piece_weight", { p_piece_id: id, p_weight_g: 1430 })).error).toBeNull();
    expect(await piece(id)).toMatchObject({ weight_g: 1430 });
    expect((await admin.rpc("discard_piece", { p_piece_id: id })).error).toBeNull();
    expect(await piece(id)).toMatchObject({ status: "descartado" });

    const { data: moves } = await service!.from("stock_movements").select("reason, delta, weight_g").eq("piece_id", id).order("id");
    expect(moves!.map((m) => [m.reason, m.delta, m.weight_g])).toEqual([
      ["ajuste", 1, 1340],
      ["correcao_peso", 0, 1430],
      ["descarte", -1, 1430],
    ]);
  });
});
