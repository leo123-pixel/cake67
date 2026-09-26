import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Staff } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;
export type StockStore = { id: string; slug: string; name: string };

export const ALL_STORES = "todas";

// Which store a stock screen shows. Attendants are pinned to their own store
// (even if it is temporarily inactive); admins pick among active stores.
export async function resolveStockStore(supabase: Client, staff: Staff, slug: string | undefined) {
  if (staff.role === "atendente") {
    const { data } = await supabase.from("stores").select("id, slug, name").eq("id", staff.storeId ?? "").maybeSingle();
    const store: StockStore = data ?? { id: staff.storeId ?? "", slug: "", name: "Sua loja" };
    return { stores: [store], store, all: false, isAdmin: false };
  }

  const { data, error } = await supabase
    .from("stores")
    .select("id, slug, name")
    .eq("active", true)
    .order("sort");
  if (error) throw new Error(`Could not load stores: ${error.message}`);

  const all = slug === ALL_STORES;
  const store = data.find((s) => s.slug === slug) ?? data[0] ?? null;
  return { stores: data, store, all, isAdmin: true };
}
