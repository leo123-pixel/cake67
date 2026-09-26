import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { buildStockGrid, hiddenReason, type GridProduct } from "@/lib/stock-grid";

type Client = SupabaseClient<Database>;

// Vitrine products the caller can see (attendants: only public ones, via RLS).
async function loadVitrineProducts(supabase: Client): Promise<GridProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, active, price_pending, store_ids, sort, category:categories(id, name, sort)")
    .eq("type", "vitrine");
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return data;
}

async function loadStock(supabase: Client, storeIds: string[]) {
  const { data, error } = await supabase
    .from("stock")
    .select("product_id, store_id, quantity")
    .in("store_id", storeIds);
  if (error) throw new Error(`Could not load stock: ${error.message}`);
  return data;
}

export async function getStockGrid(supabase: Client, storeId: string) {
  const [products, stock] = await Promise.all([loadVitrineProducts(supabase), loadStock(supabase, [storeId])]);
  return buildStockGrid(products, stock, storeId);
}

// Admin overview: one row per product visible in at least one store.
export async function getStockOverview(supabase: Client, stores: { id: string; name: string }[]) {
  const [products, stock] = await Promise.all([
    loadVitrineProducts(supabase),
    loadStock(supabase, stores.map((s) => s.id)),
  ]);
  const quantity = new Map(stock.map((row) => [`${row.product_id}:${row.store_id}`, row.quantity]));
  // Group once for all stores: ignoring store_ids here keeps products sold in
  // any store; each cell below re-checks whether that store sells it.
  const { groups } = buildStockGrid(
    products.map((p) => ({ ...p, store_ids: [] })),
    [],
    "",
  );

  const byId = new Map(products.map((p) => [p.id, p]));
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      cells: stores.map((store) => {
        const product = byId.get(item.productId)!;
        return {
          storeId: store.id,
          quantity: quantity.get(`${item.productId}:${store.id}`) ?? 0,
          sold: hiddenReason(product, store.id) === null,
        };
      }),
    })),
  }));
}

export type MovementFilters = {
  storeId?: string;
  productId?: string;
  from?: string;
  to?: string;
};

export async function listMovements(supabase: Client, filters: MovementFilters, limit: number) {
  let query = supabase
    .from("stock_movements")
    .select("id, delta, reason, quantity_after, actor_name, created_at, product:products(name), store:stores(name)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (filters.storeId) query = query.eq("store_id", filters.storeId);
  if (filters.productId) query = query.eq("product_id", filters.productId);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lt("created_at", filters.to);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load movements: ${error.message}`);
  return { movements: data.slice(0, limit), hasMore: data.length > limit };
}
