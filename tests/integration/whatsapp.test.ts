// Stage 08: the public order points to the WhatsApp of the sector that
// handles it, and the confirmation template keeps its required variables.
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

type Store = Pick<Database["public"]["Tables"]["stores"]["Row"], "id" | "whatsapp_ready" | "whatsapp_made_to_order" | "whatsapp_support">;
let store: Store;
const orderIds: string[] = [];

async function publicStore(hasMadeToOrder: boolean) {
  const { data: row, error } = await service!
    .from("orders")
    .insert({
      store_id: store.id,
      status: "confirmado",
      customer_name: "QA setor",
      customer_whatsapp: "5567900000000",
      fulfillment: "retirada",
      subtotal_cents: 0,
      has_made_to_order: hasMadeToOrder,
      scheduled_for: hasMadeToOrder ? new Date(Date.now() + 86400000).toISOString() : null,
    })
    .select("id, code, public_token")
    .single();
  if (error) throw error;
  orderIds.push(row.id);
  const { data } = await anon!.rpc("get_order_public", { p_code: row.code, p_token: row.public_token });
  return (data as { store: Record<string, string> }).store;
}

beforeAll(async () => {
  if (!configured) return;
  const { data } = await service!
    .from("stores")
    .select("id, whatsapp_ready, whatsapp_made_to_order, whatsapp_support")
    .eq("slug", "afonso-pena")
    .single();
  store = data!;
});

afterAll(async () => {
  if (!configured || !orderIds.length) return;
  await service!.from("orders").delete().in("id", orderIds);
});

describe.skipIf(!configured)("WhatsApp by sector", () => {
  it("each store has three different sector numbers", () => {
    expect(new Set([store.whatsapp_ready, store.whatsapp_made_to_order, store.whatsapp_support]).size).toBe(3);
  });

  it("a ready-made order goes to the ready-made number", async () => {
    expect(await publicStore(false)).toMatchObject({ whatsapp: store.whatsapp_ready, support_whatsapp: store.whatsapp_support });
  });

  it("an order with any made-to-order item goes to the made-to-order number", async () => {
    expect(await publicStore(true)).toMatchObject({
      whatsapp: store.whatsapp_made_to_order,
      support_whatsapp: store.whatsapp_support,
    });
  });

  it("the confirmation template needs {codigo} and {link}", async () => {
    for (const template of ["Pedido {codigo} confirmado", "Acompanhe: {link}"]) {
      const { error } = await service!.from("settings").update({ confirmation_whatsapp_template: template }).eq("id", 1);
      expect(error?.code).toBe("23514");
    }
  });

  it("the public settings do not expose the confirmation template", async () => {
    const { data } = await anon!.rpc("get_public_settings");
    expect(data).not.toHaveProperty("confirmation_whatsapp_template");
  });
});
