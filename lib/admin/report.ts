import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { csvCents, csvDateTime, type CsvValue } from "@/lib/csv";
import type { Database } from "@/lib/database.types";
import { dayEndExclusiveIso, dayStartIso } from "@/lib/datetime";
import { STATUS_LABELS } from "@/lib/order-status";
import { formatWhatsapp } from "@/lib/phone";
import { PRODUCT_TYPE_LABELS, type Period, type Report } from "@/lib/report";
import { formatTaxId } from "@/lib/tax-id";
import { formatKg } from "@/lib/weight";
import type { OrderItemSummary } from "@/lib/whatsapp";

type Client = SupabaseClient<Database>;

// PostgREST returns at most 1000 rows per request.
const PAGE_SIZE = 1000;

export async function getReport(supabase: Client, period: Period, storeId?: string): Promise<Report> {
  const { data, error } = await supabase.rpc("report_summary", {
    p_from: period.from,
    p_to: period.to,
    p_store_id: storeId ?? null,
  });
  if (error) throw new Error(`Could not load report: ${error.message}`);
  return data as unknown as Report;
}

function createdRange(period: Period) {
  const from = dayStartIso(period.from);
  const to = dayEndExclusiveIso(period.to);
  if (!from || !to) throw new Error(`Invalid period ${period.from}..${period.to}`);
  return { from, to };
}

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await page(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not export: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export const ORDER_CSV_HEADER = [
  "Número",
  "Feito em",
  "Loja",
  "Status",
  "Cliente",
  "WhatsApp",
  "CPF/CNPJ",
  "Retirada/entrega",
  "Marcado para",
  "Endereço",
  "Subtotal",
  "Motivo do cancelamento",
  "Confirmado por",
];

// Every status; the tax id goes out for invoicing (AD-011, admin only).
export async function exportOrders(supabase: Client, period: Period, storeId?: string): Promise<CsvValue[][]> {
  const { from, to } = createdRange(period);
  const orders = await fetchAll((start, end) => {
    let query = supabase
      .from("orders")
      .select(
        "code, created_at, status, customer_name, customer_whatsapp, customer_tax_id, fulfillment, scheduled_for, delivery_address, subtotal_cents, cancel_reason, store:stores(name), order_events(to_status, actor_name)",
      )
      .gte("created_at", from)
      .lt("created_at", to)
      .eq("order_events.to_status", "confirmado")
      .order("created_at")
      .order("id")
      .range(start, end);
    if (storeId) query = query.eq("store_id", storeId);
    return query;
  });

  return orders.map((order) => [
    order.code,
    csvDateTime(order.created_at),
    order.store?.name,
    STATUS_LABELS[order.status],
    order.customer_name,
    formatWhatsapp(order.customer_whatsapp),
    order.customer_tax_id ? formatTaxId(order.customer_tax_id) : "",
    order.fulfillment === "entrega" ? "Entrega" : "Retirada",
    csvDateTime(order.scheduled_for),
    order.delivery_address,
    csvCents(order.subtotal_cents),
    order.cancel_reason,
    order.order_events.at(-1)?.actor_name,
  ]);
}

export const ITEM_CSV_HEADER = [
  "Número",
  "Feito em",
  "Loja",
  "Status",
  "Produto",
  "Tipo",
  "Quantidade",
  "Opções",
  "Valor unitário",
  "Total",
];

function describeOptions(options: OrderItemSummary["options"]): string {
  if (!options) return "";
  return [
    options.weight_kg ? `${String(options.weight_kg).replace(".", ",")} kg` : null,
    options.weight_g ? formatKg(options.weight_g) : null,
    options.format,
    ...(options.addons ?? []).map((addon) => addon.name),
    options.message ? `frase "${options.message}"` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export async function exportItems(supabase: Client, period: Period, storeId?: string): Promise<CsvValue[][]> {
  const { from, to } = createdRange(period);
  const items = await fetchAll((start, end) => {
    let query = supabase
      .from("order_items")
      .select(
        "name_snapshot, type, qty, unit_price_cents, total_cents, options, position, order:orders!inner(code, created_at, status, store_id, store:stores(name))",
      )
      .gte("order.created_at", from)
      .lt("order.created_at", to)
      .order("id")
      .range(start, end);
    if (storeId) query = query.eq("order.store_id", storeId);
    return query;
  });

  return items
    .sort(
      (a, b) =>
        a.order.created_at.localeCompare(b.order.created_at) || a.order.code.localeCompare(b.order.code) || a.position - b.position,
    )
    .map((item) => [
      item.order.code,
      csvDateTime(item.order.created_at),
      item.order.store?.name,
      STATUS_LABELS[item.order.status],
      item.name_snapshot,
      PRODUCT_TYPE_LABELS[item.type],
      item.qty,
      describeOptions(item.options as OrderItemSummary["options"]),
      csvCents(item.unit_price_cents),
      csvCents(item.total_cents),
    ]);
}
