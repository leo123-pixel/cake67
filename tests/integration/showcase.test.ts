// Stage 07: the public home lists cakes with a pending price, but never their
// provisional price, and the site still cannot order them (AD-012).
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);
const options = { auth: { persistSession: false, autoRefreshToken: false } };

type ShowcaseCake = { id: string; slug: string; price_cents: number | null };

describe.skipIf(!configured)("cake showcase", () => {
  const anon = createClient<Database>(url!, anonKey!, options);
  const service = createClient<Database>(url!, serviceKey!, options);

  it("anon sees every active cake and no pending price", async () => {
    const [{ data, error }, { data: cakes }] = await Promise.all([
      anon.rpc("list_cake_showcase"),
      service.from("products").select("id, price_pending").eq("type", "bolo_kg").eq("active", true),
    ]);
    expect(error).toBeNull();
    const showcase = data as unknown as ShowcaseCake[];
    expect(showcase.map((c) => c.id).sort()).toEqual(cakes!.map((c) => c.id).sort());
    for (const cake of cakes!.filter((c) => c.price_pending)) {
      expect(showcase.find((c) => c.id === cake.id)!.price_cents).toBeNull();
    }
  });

  it("a pending-price cake stays hidden from the products table and cannot be quoted", async () => {
    const { data: pending } = await service
      .from("products")
      .select("id")
      .eq("type", "bolo_kg")
      .eq("price_pending", true)
      .limit(1)
      .maybeSingle();
    if (!pending) return;
    const { data: rows } = await anon.from("products").select("id").eq("id", pending.id);
    expect(rows).toEqual([]);
    const { data: stores } = await anon.from("stores").select("id").limit(1);
    const { data: quote } = await anon.rpc("quote_order", {
      p_store_id: stores![0].id,
      p_items: [{ product_id: pending.id, qty: 1, weight_kg: "2", format: "Redondo" }],
    });
    expect((quote as { lines: { problem: string }[] }).lines[0].problem).toBe("indisponivel");
  });
});
