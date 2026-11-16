import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTimeline } from "@/components/site/order-timeline";
import { PayButton } from "@/components/site/pay-button";
import { PaymentPoll } from "@/components/site/payment-poll";
import { formatBRL } from "@/lib/money";
import { describeMethod, describePaid } from "@/lib/payments/labels";
import { onlinePaymentReady } from "@/lib/payments/server";
import { publicStatus } from "@/lib/order-status";
import { buildTimeline } from "@/lib/order-timeline";
import { getOrderPublic, getPublicSettings } from "@/lib/storefront";
import {
  describeConfirmedFulfillment,
  describeFulfillment,
  describeItem,
  renderOrderMessage,
  whatsappLink,
} from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Seu pedido", robots: { index: false, follow: false } };

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string; pagamento?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ code }, { t, pagamento }] = await Promise.all([params, searchParams]);
  const order = await getOrderPublic(code, t ?? "");
  if (!order) notFound();

  // Stage 12: online payment (InfinitePay). The database says whether the order
  // can be paid; the server says whether the store's key is configured.
  const payment = order.payment;
  const paid = payment.status === "pago";
  const review = payment.status === "conferir";
  const payable = order.status === "novo" && onlinePaymentReady(payment.handle);
  const confirming = payable && payment.status === "aguardando_pagamento" && pagamento === "retorno";

  const settings = await getPublicSettings();
  const status = publicStatus(order.status, order.fulfillment);
  const statusText =
    order.status !== "novo"
      ? status.text
      : paid || review
        ? "Seu pagamento chegou. A loja vai confirmar o pedido."
        : payable
          ? "Falta um passo: pague pelo site com Pix ou cartão, ou finalize pelo WhatsApp."
          : status.text;
  // A new order goes to the sector that handles it; afterwards, questions go to the SAC.
  const isNew = order.status === "novo";
  const link = isNew
    ? whatsappLink(
        order.store.whatsapp,
        renderOrderMessage(settings.order_whatsapp_template, order, settings.reservation_minutes) +
          (paid ? "\n\nPagamento feito pelo site." : ""),
      )
    : whatsappLink(order.store.support_whatsapp, `Olá, Cake 67! Sobre o pedido ${order.code}…`);

  return (
    <div className="bg-linen text-cocoa">
      <section className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-8">
        <header className="space-y-2">
          <p className="text-xs font-medium tracking-[0.32em] text-raspberry uppercase">{status.title}</p>
          <h1 className="text-4xl text-olive tabular-nums">{order.code}</h1>
          <p>{statusText}</p>
        </header>

        {(paid || review) && (
          <section role="status" className="space-y-1 rounded-3xl bg-olive/10 p-5">
            <p className="font-medium text-olive-dark">
              {paid ? "Pagamento recebido" : "Recebemos um pagamento e a loja vai conferir"}
            </p>
            <p className="text-sm">
              {describeMethod(payment.method, payment.installments)} · {describePaid(payment.amount_cents, payment.paid_amount_cents)}
            </p>
            {paid && isNew && <p className="text-sm">A loja vai confirmar seu pedido.</p>}
            {payment.receipt_url && (
              <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sm text-olive underline">
                Ver comprovante
              </a>
            )}
          </section>
        )}
        {confirming && (
          <p role="status" className="rounded-3xl bg-peach-light p-5">
            Confirmando pagamento… Esta página atualiza sozinha.
            <PaymentPoll />
          </p>
        )}
        {payable && pagamento === "falhou" && (
          <p role="alert" className="rounded-3xl bg-raspberry/10 p-5 text-raspberry">
            Não conseguimos abrir o pagamento agora. Tente de novo ou finalize pelo WhatsApp.
          </p>
        )}
        {payable && payment.status === "expirado" && (
          <p className="rounded-3xl bg-peach-light p-5">O link de pagamento expirou. Gere um novo para pagar.</p>
        )}

        {isNew && payable && !confirming ? (
          <div className="space-y-3">
            <PayButton code={order.code} token={t ?? ""} />
            <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full">
              Finalizar no WhatsApp
            </a>
          </div>
        ) : isNew && (paid || review || confirming) ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full">
            Avisar a loja no WhatsApp
          </a>
        ) : isNew ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="btn w-full bg-olive text-lg text-linen hover:bg-olive-dark">
            Finalizar no WhatsApp
          </a>
        ) : (
          <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full">
            Falar com a loja
          </a>
        )}

        <OrderTimeline timeline={buildTimeline(order)} />

        <section className="space-y-3 rounded-3xl border border-cocoa/10 bg-white p-5">
          <p className="text-sm text-cocoa-soft">
            {order.store.name} · {order.store.address}
          </p>
          <p className="font-medium">
            {isNew ? describeFulfillment(order, settings.reservation_minutes) : describeConfirmedFulfillment(order)}
          </p>
          <ul className="space-y-1 border-t border-cocoa/10 pt-3 text-sm">
            {order.items.map((item, index) => (
              <li key={index} className="flex justify-between gap-3">
                <span>{describeItem(item)}</span>
                <span className="shrink-0 tabular-nums">{formatBRL(item.total_cents)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t border-cocoa/10 pt-2 font-medium">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatBRL(order.subtotal_cents)}</span>
          </p>
          {order.fulfillment === "entrega" &&
            (order.delivery_fee_cents === null ? (
              <p className="text-sm text-cocoa-soft">Taxa de entrega combinada no WhatsApp.</p>
            ) : (
              <>
                <p className="flex justify-between text-sm">
                  <span>Entrega</span>
                  <span className="tabular-nums">{formatBRL(order.delivery_fee_cents)}</span>
                </p>
                <p className="flex justify-between border-t border-cocoa/10 pt-2 text-lg font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">{formatBRL(order.total_cents)}</span>
                </p>
              </>
            ))}
        </section>

        <p className="text-sm text-cocoa-soft">
          Guarde este link para ver o pedido de novo. <Link href="/cardapio" className="underline">Voltar ao cardápio</Link>
        </p>
      </section>
    </div>
  );
}
