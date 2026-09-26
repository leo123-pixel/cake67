// Order message for the store's WhatsApp (SPEC §5), from the template in settings.
import { formatPickup } from "@/lib/datetime";
import { formatBRL } from "@/lib/money";
import { formatWhatsapp } from "@/lib/phone";

export type OrderItemSummary = {
  name: string;
  type: "vitrine" | "bolo_kg" | "cento" | "kit";
  qty: number;
  total_cents: number;
  options: {
    weight_kg?: number;
    format?: string;
    addons?: { name: string }[];
    message?: string | null;
  } | null;
};

export type OrderSummary = {
  code: string;
  fulfillment: "retirada" | "entrega";
  delivery_address: string | null;
  scheduled_for: string | null;
  customer_name: string;
  customer_whatsapp: string;
  notes: string | null;
  subtotal_cents: number;
  store: { name: string; address: string; whatsapp: string };
  items: OrderItemSummary[];
};

function kg(weight: number) {
  return `${String(weight).replace(".", ",")} kg`;
}

export function describeItem(item: OrderItemSummary): string {
  const options = item.options ?? {};
  if (item.type === "cento") return `${item.qty} un. ${item.name}`;
  if (item.type === "bolo_kg") {
    const details = [options.weight_kg ? kg(options.weight_kg) : null, options.format, ...(options.addons ?? []).map((a) => a.name)]
      .filter(Boolean)
      .join(", ");
    return `${item.qty}x ${item.name}${details ? ` ${details}` : ""}`;
  }
  return `${item.qty}x ${item.name}`;
}

export function describeFulfillment(order: OrderSummary, reservationMinutes: number): string {
  const when = order.scheduled_for ? ` em ${formatPickup(order.scheduled_for)}` : "";
  if (order.fulfillment === "entrega") {
    const address = order.delivery_address ? ` · Endereço: ${order.delivery_address}` : "";
    return `Quero entrega (taxa a combinar)${when}${address}`;
  }
  if (when) return `Retirada${when}`;
  const hours = reservationMinutes / 60;
  return `Retirada em até ${Number.isInteger(hours) ? `${hours} h` : `${reservationMinutes} min`}`;
}

function describeNotes(order: OrderSummary): string {
  const phrases = order.items
    .map((item) => item.options?.message)
    .filter((message): message is string => Boolean(message))
    .map((message) => `frase "${message}"`);
  const parts = [...phrases, order.notes].filter(Boolean);
  return parts.length ? `Obs.: ${parts.join(" · ")}` : "";
}

export function renderOrderMessage(template: string, order: OrderSummary, reservationMinutes: number): string {
  const values: Record<string, string> = {
    codigo: order.code,
    loja: order.store.address,
    entrega: describeFulfillment(order, reservationMinutes),
    itens: order.items.map((item) => `${describeItem(item)} – ${formatBRL(item.total_cents)}`).join("\n"),
    subtotal: formatBRL(order.subtotal_cents),
    nome: order.customer_name,
    whatsapp: formatWhatsapp(order.customer_whatsapp),
    observacoes: describeNotes(order),
  };
  return template
    .replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
    .replace(/\n+$/, "");
}

export function whatsappLink(phoneDigits: string, text: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`;
}
