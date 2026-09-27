import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export async function listAdminCategories(supabase: Client) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, kind, active, sort, products(count)")
    .order("sort");
  if (error) throw new Error(`Could not load categories: ${error.message}`);
  return data.map(({ products, ...category }) => ({
    ...category,
    productCount: products[0]?.count ?? 0,
  }));
}

export type AdminCategory = Awaited<ReturnType<typeof listAdminCategories>>[number];

export async function listAdminAddons(supabase: Client) {
  const { data, error } = await supabase
    .from("addons")
    .select("id, name, price_cents, active, sort")
    .order("sort");
  if (error) throw new Error(`Could not load addons: ${error.message}`);
  return data;
}

export type AdminAddon = Awaited<ReturnType<typeof listAdminAddons>>[number];

export async function listAdminStores(supabase: Client) {
  const { data, error } = await supabase
    .from("stores")
    .select("id, slug, name, address, phone, whatsapp, hours, active, sort")
    .order("sort");
  if (error) throw new Error(`Could not load stores: ${error.message}`);
  return data;
}

export type AdminStore = Awaited<ReturnType<typeof listAdminStores>>[number];
