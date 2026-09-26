import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { OrderActions } from "@/components/admin/orders/order-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { getOrder } from "@/lib/admin/orders";
import { requireStaff } from "@/lib/auth";
import { formatDateTime, formatPickup } from "@/lib/datetime";
import { formatBRL } from "@/lib/money";
import { minutesLeft, STATUS_LABELS, STATUS_TONES } from "@/lib/order-status";
import { formatWhatsapp } from "@/lib/phone";
import { formatTaxId } from "@/lib/tax-id";
import { describeItem, whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Pedido" };

type Props = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { supabase } = await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  // RLS hides orders from other stores: they come back as not found.
  const detail = await getOrder(supabase, id);
  if (!detail) notFound();
  const { order, items, events } = detail;

  const left = order.status === "novo" ? minutesLeft(order.expires_at) : null;
  const greeting = `Olá, ${order.customer_name}! Sobre o pedido ${order.code} da Cake 67…`;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link href="/admin/pedidos" className="text-sm text-olive underline">
          ← Pedidos
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl text-olive tabular-nums">{order.code}</h1>
          <StatusBadge tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</StatusBadge>
          {left !== null && <StatusBadge tone={left < 30 ? "red" : "amber"}>expira em {left} min</StatusBadge>}
        </div>
        <p className="text-sm text-cocoa-soft">
          {order.store?.name} · feito {formatDateTime(order.created_at)}
        </p>
      </header>

      <OrderActions orderId={order.id} status={order.status} hasMadeToOrder={order.has_made_to_order} />

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-2xl border border-cocoa/10 bg-white p-4">
          <h2 className="text-xl text-olive">Cliente</h2>
          <p className="font-medium">{order.customer_name}</p>
          <p className="text-sm">WhatsApp {formatWhatsapp(order.customer_whatsapp)}</p>
          {order.customer_tax_id && <p className="text-sm">CPF/CNPJ {formatTaxId(order.customer_tax_id)}</p>}
          <a
            href={whatsappLink(order.customer_whatsapp, greeting)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            WhatsApp do cliente
          </a>
        </div>

        <div className="space-y-2 rounded-2xl border border-cocoa/10 bg-white p-4">
          <h2 className="text-xl text-olive">{order.fulfillment === "entrega" ? "Entrega" : "Retirada"}</h2>
          <p className="font-medium">{order.scheduled_for ? formatPickup(order.scheduled_for) : "Vitrine: retirar no dia"}</p>
          {order.delivery_address && <p className="text-sm">{order.delivery_address}</p>}
          {order.fulfillment === "entrega" && <p className="text-sm text-cocoa-soft">Taxa combinada no WhatsApp.</p>}
          {order.notes && <p className="text-sm">Obs.: {order.notes}</p>}
          <Link href={`/admin/pedidos/${order.id}/comanda`} target="_blank" className="btn btn-secondary">
            Imprimir comanda
          </Link>
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border border-cocoa/10 bg-white p-4">
        <h2 className="text-xl text-olive">Itens</h2>
        <ul className="divide-y divide-cocoa/10 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2">
              <span>
                {describeItem(item)}
                {item.options?.message && <span className="block text-raspberry">Frase: “{item.options.message}”</span>}
              </span>
              <span className="shrink-0 tabular-nums">{formatBRL(item.total_cents)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-cocoa/10 pt-2 font-medium">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatBRL(order.subtotal_cents)}</span>
        </p>
      </section>

      <section className="space-y-2 rounded-2xl border border-cocoa/10 bg-white p-4">
        <h2 className="text-xl text-olive">Histórico</h2>
        <ol className="space-y-1 text-sm">
          {events.map((event) => (
            <li key={event.id}>
              <span className="text-cocoa-soft">{formatDateTime(event.created_at)}</span> ·{" "}
              {STATUS_LABELS[event.to_status]} · {event.actor_name}
              {event.note && <span className="text-cocoa-soft"> · {event.note}</span>}
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
