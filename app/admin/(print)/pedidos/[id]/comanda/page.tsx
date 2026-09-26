import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PrintOnLoad } from "@/components/admin/orders/print-on-load";
import { getOrder } from "@/lib/admin/orders";
import { requireStaff } from "@/lib/auth";
import { formatDateTime, formatPickup } from "@/lib/datetime";
import { formatBRL } from "@/lib/money";
import { formatWhatsapp } from "@/lib/phone";
import { describeItem } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Comanda" };

type Props = { params: Promise<{ id: string }> };

// Kitchen/counter slip. Fits an 80 mm roll and prints fine on A4.
// The tax id is intentionally left out (it stays in the order detail).
export default async function OrderSlipPage({ params }: Props) {
  const { supabase } = await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getOrder(supabase, id);
  if (!detail) notFound();
  const { order, items } = detail;

  return (
    <main className="mx-auto w-full max-w-[80mm] space-y-3 bg-white p-3 font-sans text-[13px] leading-snug text-black print:p-0">
      <style>{"@page { margin: 6mm; } @media print { body { background: white; } }"}</style>
      <PrintOnLoad />

      <header className="border-b border-dashed border-black pb-2 text-center">
        <p className="text-lg font-semibold">Cake 67 · {order.store?.name}</p>
        <p className="text-2xl font-bold tabular-nums">{order.code}</p>
        <p>Feito {formatDateTime(order.created_at)}</p>
      </header>

      <section className="border-b border-dashed border-black pb-2">
        <p className="font-semibold uppercase">{order.fulfillment === "entrega" ? "Entrega" : "Retirada"}</p>
        <p className="text-base font-semibold">{order.scheduled_for ? formatPickup(order.scheduled_for) : "Vitrine"}</p>
        {order.delivery_address && <p>{order.delivery_address}</p>}
        <p>
          {order.customer_name} · {formatWhatsapp(order.customer_whatsapp)}
        </p>
      </section>

      <section className="space-y-1 border-b border-dashed border-black pb-2">
        {items.map((item) => (
          <div key={item.id}>
            <p className="flex justify-between gap-2">
              <span className="font-semibold">{describeItem(item)}</span>
              <span className="shrink-0 tabular-nums">{formatBRL(item.total_cents)}</span>
            </p>
            {item.options?.message && <p className="border border-black px-1 text-base font-bold">FRASE: “{item.options.message}”</p>}
          </div>
        ))}
      </section>

      {order.notes && <p className="border-b border-dashed border-black pb-2">Obs.: {order.notes}</p>}

      <p className="flex justify-between text-base font-semibold">
        <span>Subtotal</span>
        <span className="tabular-nums">{formatBRL(order.subtotal_cents)}</span>
      </p>
      <p className="text-center text-[11px]">Pagamento e taxa de entrega combinados no WhatsApp.</p>
    </main>
  );
}
