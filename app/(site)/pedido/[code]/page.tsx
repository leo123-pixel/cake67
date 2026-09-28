import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTimeline } from "@/components/site/order-timeline";
import { formatBRL } from "@/lib/money";
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

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ code }, { t }] = await Promise.all([params, searchParams]);
  const order = await getOrderPublic(code, t ?? "");
  if (!order) notFound();

  const settings = await getPublicSettings();
  const status = publicStatus(order.status, order.fulfillment);
  // A new order goes to the sector that handles it; afterwards, questions go to the SAC.
  const isNew = order.status === "novo";
  const link = isNew
    ? whatsappLink(order.store.whatsapp, renderOrderMessage(settings.order_whatsapp_template, order, settings.reservation_minutes))
    : whatsappLink(order.store.support_whatsapp, `Olá, Cake 67! Sobre o pedido ${order.code}…`);

  return (
    <div className="bg-linen text-cocoa">
      <section className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-8">
        <header className="space-y-2">
          <p className="text-xs font-medium tracking-[0.32em] text-raspberry uppercase">{status.title}</p>
          <h1 className="text-4xl text-olive tabular-nums">{order.code}</h1>
          <p>{status.text}</p>
        </header>

        {isNew ? (
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
          {order.fulfillment === "entrega" && <p className="text-sm text-cocoa-soft">Taxa de entrega combinada no WhatsApp.</p>}
        </section>

        <p className="text-sm text-cocoa-soft">
          Guarde este link para ver o pedido de novo. <Link href="/cardapio" className="underline">Voltar ao cardápio</Link>
        </p>
      </section>
    </div>
  );
}
