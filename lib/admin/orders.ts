import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { dayEndExclusiveIso, dayStartIso } from "@/lib/datetime";
import type { OrderStatus } from "@/lib/order-status";
import type { OrderItemSummary } from "@/lib/whatsapp";

type Client = SupabaseClient<Database>;

const LIST_COLUMNS =
  "id, code, status, created_at, expires_at, customer_name, fulfillment, scheduled_for, subtotal_cents, has_made_to_order, store_id, store:stores(name)";

// Overdue orders become "expirado" before any list is shown (SPEC §5.6).
async function expireOverdue(supabase: Client) {
  const { error } = await supabase.rpc("expire_orders");
  if (error) throw new Error(`Could not expire orders: ${error.message}`);
}

function dayRange(date: string) {
  const from = dayStartIso(date);
  const to = dayEndExclusiveIso(date);
  if (!from || !to) throw new Error(`Invalid date ${date}`);
  return { from, to };
}

export type OrderFilters = { storeId?: string; status?: OrderStatus; date: string };

// Orders made on `date` (Campo Grande) plus every "novo" order, newest first,
// with "novo" on top. RLS limits attendants to their store.
export async function listOrders(supabase: Client, filters: OrderFilters) {
  await expireOverdue(supabase);
  const { from, to } = dayRange(filters.date);

  let query = supabase.from("orders").select(LIST_COLUMNS).order("created_at", { ascending: false }).limit(300);
  if (filters.storeId) query = query.eq("store_id", filters.storeId);
  if (filters.status === "novo") {
    query = query.eq("status", "novo");
  } else if (filters.status) {
    query = query.eq("status", filters.status).gte("created_at", from).lt("created_at", to);
  } else {
    query = query.or(`status.eq.novo,and(created_at.gte.${from},created_at.lt.${to})`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load orders: ${error.message}`);
  return [...data].sort((a, b) => Number(b.status === "novo") - Number(a.status === "novo"));
}

export type OrderListItem = Awaited<ReturnType<typeof listOrders>>[number];

export async function getOrder(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("*, store:stores(name, address, whatsapp), order_items(*), order_events(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load order: ${error.message}`);
  if (!data) return null;

  const { order_items, order_events, ...order } = data;
  return {
    order,
    items: [...order_items]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ ...item, name: item.name_snapshot, options: item.options as OrderItemSummary["options"] })),
    events: [...order_events].sort((a, b) => a.id - b.id),
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export async function getDashboard(supabase: Client, date: string, storeId?: string) {
  await expireOverdue(supabase);
  const { from, to } = dayRange(date);
  const scoped = <T extends { eq: (column: "store_id", value: string) => T }>(query: T) =>
    storeId ? query.eq("store_id", storeId) : query;

  const [pending, today, outToday] = await Promise.all([
    scoped(supabase.from("orders").select(LIST_COLUMNS).eq("status", "novo").order("created_at")),
    scoped(supabase.from("orders").select("status").gte("created_at", from).lt("created_at", to)),
    scoped(
      supabase
        .from("orders")
        .select(LIST_COLUMNS)
        .in("status", ["confirmado", "em_producao", "pronto"])
        .gte("scheduled_for", from)
        .lt("scheduled_for", to)
        .order("scheduled_for"),
    ),
  ]);
  const failed = pending.error ?? today.error ?? outToday.error;
  if (failed) throw new Error(`Could not load dashboard: ${failed.message}`);

  const counts = new Map<OrderStatus, number>();
  for (const row of today.data!) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);

  return { pending: pending.data!, counts, outToday: outToday.data! };
}
