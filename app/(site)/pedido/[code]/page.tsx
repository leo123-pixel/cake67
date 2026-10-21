import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTimeline } from "@/components/site/order-timeline";
import { PayButton } from "@/components/site/pay-button";
import { PaymentPoll } from "@/components/site/payment-poll";
import { formatBRL } from "@/lib/money";
import { publicStatus } from "@/lib/order-status";
import { parseReturn, paymentView } from "@/lib/payments/public";
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

  const settings = await getPublicSettings();
  const status = publicStatus(order.status, order.fulfillment);
  // A new order goes to the sector that handles it; afterwards, questions go to the SAC.
  const isNew = order.status === "novo";
  const payment = paymentView(order.status, order.payment, parseReturn(pagamento));
  // Stage 11: a paid order still goes to the sector, saying it was paid.
  const orderMessage = renderOrderMessage(settings.order_whatsapp_template, order, settings.reservation_minutes);
  const link = isNew
    ? whatsappLink(order.store.whatsapp, payment.paid ? `${orderMessage}\n\nPago pelo site` : orderMessage)
    : whatsappLink(order.store.support_whatsapp, `Olá, Cake 67! Sobre o pedido ${order.code}…`);

  return (
    <div className="bg-linen text-cocoa">
      <section className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-8">
        <header className="space-y-2">
          <p className="text-xs font-medium tracking-[0.32em] text-raspberry uppercase">{status.title}</p>
          <h1 className="text-4xl text-olive tabular-nums">{order.code}</h1>
          <p>{(isNew && payment.statusText) || status.text}</p>
        </header>

        {payment.notice && (
          <p
            role={payment.notice.tone === "error" ? "alert" : "status"}
            className={`rounded-2xl p-4 text-sm ${payment.notice.tone === "error" ? "bg-raspberry/10 text-raspberry" : "bg-peach-light"}`}
          >
            {payment.notice.text}
          </p>
        )}
        {payment.poll && <PaymentPoll />}

        {payment.canPay ? (
          <>
            <PayButton code={order.code} token={t!} />
            <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full">
              Finalizar no WhatsApp
            </a>
          </>
        ) : isNew && payment.paid ? (
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
          {payment.badge && <p className="text-sm font-medium text-olive">{payment.badge}</p>}
          {payment.paid && order.items.some((item) => item.type === "bolo_kg") && (
            <p className="text-sm text-cocoa-soft">A diferença da pesagem do bolo é paga na retirada.</p>
          )}
          {order.fulfillment === "entrega" && <p className="text-sm text-cocoa-soft">Taxa de entrega combinada no WhatsApp.</p>}
        </section>

        <p className="text-sm text-cocoa-soft">
          Guarde este link para ver o pedido de novo. <Link href="/cardapio" className="underline">Voltar ao cardápio</Link>
        </p>
      </section>
    </div>
  );
}
