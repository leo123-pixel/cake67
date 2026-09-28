// Stage 09: the public order carries its status history, and nothing
// internal (who changed it, the cancel reason) leaks with it.
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = configured ? createClient<Database>(url!, serviceKey!, options) : null;
const anon = configured ? createClient<Database>(url!, anonKey!, options) : null;

const order = { id: "", code: "", token: "" };

beforeAll(async () => {
  if (!configured) return;
  const { data: store } = await service!.from("stores").select("id").eq("slug", "estiva").single();
  const { data, error } = await service!
    .from("orders")
    .insert({
      store_id: store!.id,
      customer_name: "QA linha do tempo",
      customer_whatsapp: "5567900000900",
      fulfillment: "retirada",
      subtotal_cents: 0,
    })
    .select("id, code, public_token")
    .single();
  if (error) throw error;
  Object.assign(order, { id: data.id, code: data.code, token: data.public_token });
  await service!.from("orders").update({ status: "confirmado" }).eq("id", order.id);
  await service!.from("orders").update({ status: "cancelado", cancel_reason: "Motivo interno QA" }).eq("id", order.id);
});

afterAll(async () => {
  if (!configured || !order.id) return;
  await service!.from("orders").delete().eq("id", order.id);
});

describe.skipIf(!configured)("public order timeline", () => {
  it("returns every status change in order, with status and time only", async () => {
    const { data } = await anon!.rpc("get_order_public", { p_code: order.code, p_token: order.token });
    const events = (data as { events: Record<string, unknown>[] }).events;
    expect(events.map((e) => e.status)).toEqual(["novo", "confirmado", "cancelado"]);
    for (const event of events) {
      expect(Object.keys(event).sort()).toEqual(["at", "status"]);
      expect(Number.isNaN(Date.parse(String(event.at)))).toBe(false);
    }
    expect(JSON.stringify(data)).not.toContain("Motivo interno QA");
  });

  it("a wrong token still returns nothing", async () => {
    const { data } = await anon!.rpc("get_order_public", { p_code: order.code, p_token: "0".repeat(32) });
    expect(data).toBeNull();
  });
});
