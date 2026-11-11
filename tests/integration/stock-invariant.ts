// Shared check: the movements of every stock row sum to its quantity.
// The Data API returns at most 1000 rows per request (max_rows), whatever
// .limit() asks for, so both tables are read page by page.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const PAGE = 1000;

async function readAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data!);
    if (data!.length < PAGE) return rows;
  }
}

export async function stockMismatches(service: SupabaseClient<Database>) {
  const [stock, movements] = await Promise.all([
    readAll((from, to) =>
      service.from("stock").select("product_id, store_id, quantity").order("product_id").order("store_id").range(from, to),
    ),
    readAll((from, to) => service.from("stock_movements").select("product_id, store_id, delta").order("id").range(from, to)),
  ]);
  const sums = new Map<string, number>();
  for (const m of movements) {
    const k = `${m.product_id}:${m.store_id}`;
    sums.set(k, (sums.get(k) ?? 0) + m.delta);
  }
  return stock.filter((r) => (sums.get(`${r.product_id}:${r.store_id}`) ?? 0) !== r.quantity);
}
