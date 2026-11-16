import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { OrderActions } from "@/components/admin/orders/order-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { getConfirmationTemplate, getOrder } from "@/lib/admin/orders";
import { requireStaff } from "@/lib/auth";
import { formatDateTime, formatPickup } from "@/lib/datetime";
import { siteUrl } from "@/lib/env";
import { formatBRL } from "@/lib/money";
import { minutesLeft, STATUS_LABELS, STATUS_TONES } from "@/lib/order-status";
import { describeMethod, describePaid, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES } from "@/lib/payments/labels";
import { formatWhatsapp } from "@/lib/phone";
import { formatTaxId } from "@/lib/tax-id";
import { describeItem, renderConfirmationMessage, whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Pedido" };

type Props = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { supabase } = await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  // RLS hides orders from other stores: they come back as not found.
  const [detail, confirmationTemplate] = await Promise.all([getOrder(supabase, id), getConfirmationTemplate(supabase)]);
  if (!detail) notFound();
  const { order, items, events, paymentEvents } = detail;
  const moneyIn = order.payment_status === "pago" || order.payment_status === "conferir";

  const left = order.status === "novo" ? minutesLeft(order.expires_at) : null;
  const greeting = `Olá, ${order.customer_name}! Sobre o pedido ${order.code} da Cake 67…`;
  // The customer's own link: the token only goes to the customer's WhatsApp.
  const trackingUrl = `${siteUrl()}/pedido/${encodeURIComponent(order.code)}?t=${order.public_token}`;
  const notifyHref = order.store
    ? whatsappLink(order.customer_whatsapp, renderConfirmationMessage(confirmationTemplate, { ...order, store: order.store }, trackingUrl))
    : null;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link href="/admin/pedidos" className="inline-flex min-h-11 items-center text-sm text-olive underline">
          ← Pedidos
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl text-olive tabular-nums">{order.code}</h1>
          <StatusBadge tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</StatusBadge>
          {left !== null && <StatusBadge tone={left < 30 ? "red" : "amber"}>expira em {left} min</StatusBadge>}
          {order.payment_status && (
            <StatusBadge tone={PAYMENT_STATUS_TONES[order.payment_status]}>{PAYMENT_STATUS_LABELS[order.payment_status]}</StatusBadge>
          )}
        </div>
        <p className="text-sm text-cocoa-soft">
          {order.store?.name} · feito {formatDateTime(order.created_at)}
        </p>
      </header>

      <OrderActions
        orderId={order.id}
        status={order.status}
        hasMadeToOrder={order.has_made_to_order}
        notifyHref={notifyHref}
        paidText={moneyIn ? describePaid(order.amount_cents, order.paid_amount_cents) : null}
      />

      {order.payment_status && (
        <section className="space-y-2 rounded-2xl border border-cocoa/10 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl text-olive">Pagamento online</h2>
            <StatusBadge tone={PAYMENT_STATUS_TONES[order.payment_status]}>{PAYMENT_STATUS_LABELS[order.payment_status]}</StatusBadge>
          </div>
          {order.payment_note && (
            <p role="alert" className="rounded-xl bg-raspberry/10 p-3 text-sm text-raspberry">
              {order.payment_note}
            </p>
          )}
          {order.status === "cancelado" && order.payment_status === "pago" && (
            <p role="alert" className="rounded-xl bg-raspberry/10 p-3 text-sm text-raspberry">
              Pedido cancelado com pagamento recebido: faça o estorno pelo app ou pela Conta Web da InfinitePay.
            </p>
          )}
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-cocoa-soft">Valor cobrado</dt>
            <dd className="tabular-nums">{order.amount_cents === null ? "—" : formatBRL(order.amount_cents)}</dd>
            {moneyIn && (
              <>
                <dt className="text-cocoa-soft">Forma</dt>
                <dd>{describeMethod(order.capture_method, order.installments)}</dd>
                <dt className="text-cocoa-soft">Valor pago</dt>
                <dd className="tabular-nums">{describePaid(order.amount_cents, order.paid_amount_cents)}</dd>
                {order.paid_at && (
                  <>
                    <dt className="text-cocoa-soft">Pago em</dt>
                    <dd>{formatDateTime(order.paid_at)}</dd>
                  </>
                )}
                {order.transaction_nsu && (
                  <>
                    <dt className="text-cocoa-soft">Transação</dt>
                    <dd className="break-all">{order.transaction_nsu}</dd>
                  </>
                )}
              </>
            )}
            {order.payment_status === "aguardando_pagamento" && order.payment_valid_until && (
              <>
                <dt className="text-cocoa-soft">Link vale até</dt>
                <dd>{formatDateTime(order.payment_valid_until)}</dd>
              </>
            )}
            <dt className="text-cocoa-soft">Conta</dt>
            <dd>{order.payment_handle ? "$" + order.payment_handle : "—"}</dd>
          </dl>
          {order.receipt_url && (
            <a href={order.receipt_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              Ver comprovante
            </a>
          )}
          {paymentEvents.length > 0 && (
            <details className="text-sm">
              <summary className="min-h-11 cursor-pointer py-2 text-cocoa-soft">Registro da InfinitePay ({paymentEvents.length})</summary>
              <ol className="space-y-1">
                {paymentEvents.map((event) => (
                  <li key={event.id}>
                    <span className="text-cocoa-soft">{formatDateTime(event.created_at)}</span> · {event.source} · {event.kind}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </section>
      )}

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
          {order.fulfillment === "entrega" &&
            (order.delivery_fee_cents === null ? (
              <p>
                <StatusBadge tone="amber">Taxa a combinar no WhatsApp</StatusBadge>
              </p>
            ) : (
              <p className="text-sm">Taxa de entrega (Juma): {formatBRL(order.delivery_fee_cents)}</p>
            ))}
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
        {order.fulfillment === "entrega" && (
          <>
            <p className="flex justify-between text-sm">
              <span>Entrega</span>
              <span className="tabular-nums">{order.delivery_fee_cents === null ? "a combinar" : formatBRL(order.delivery_fee_cents)}</span>
            </p>
            <p className="flex justify-between border-t border-cocoa/10 pt-2 text-lg font-medium">
              <span>Total</span>
              <span className="tabular-nums">
                {formatBRL(order.total_cents)}
                {order.delivery_fee_cents === null && <span className="text-sm font-normal"> + entrega</span>}
              </span>
            </p>
          </>
        )}
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
