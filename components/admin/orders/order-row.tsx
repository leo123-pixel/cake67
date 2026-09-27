import Link from "next/link";
import { StatusBadge } from "@/components/admin/status-badge";
import type { OrderListItem } from "@/lib/admin/orders";
import { formatPickup, formatSince } from "@/lib/datetime";
import { formatBRL } from "@/lib/money";
import { minutesLeft, STATUS_LABELS, STATUS_TONES } from "@/lib/order-status";

const URGENT_MINUTES = 30;

export function OrderRow({ order, showStore }: { order: OrderListItem; showStore: boolean }) {
  const left = order.status === "novo" ? minutesLeft(order.expires_at) : null;
  const when = order.scheduled_for ? formatPickup(order.scheduled_for) : "vitrine";
  const how = order.fulfillment === "entrega" ? "Entrega" : "Retirada";

  return (
    <li>
      <Link
        href={`/admin/pedidos/${order.id}`}
        className={`flex items-start justify-between gap-3 p-4 hover:bg-olive/5 ${order.status === "novo" ? "bg-peach-light/60" : ""}`}
      >
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium tabular-nums">{order.code}</span>
            <StatusBadge tone={STATUS_TONES[order.status]}>{STATUS_LABELS[order.status]}</StatusBadge>
            {left !== null && left < URGENT_MINUTES && (
              <StatusBadge tone="red">{left === 0 ? "expirando" : `expira em ${left} min`}</StatusBadge>
            )}
          </p>
          <p className="truncate text-sm">{order.customer_name}</p>
          <p className="text-sm text-cocoa-soft">
            {how} · {when}
            {showStore && order.store ? ` · ${order.store.name}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right text-sm">
          <p className="tabular-nums">{formatBRL(order.subtotal_cents)}</p>
          <p className="text-cocoa-soft">{formatSince(order.created_at)}</p>
        </div>
      </Link>
    </li>
  );
}

export function OrderList({ orders, showStore, empty }: { orders: OrderListItem[]; showStore: boolean; empty: string }) {
  if (orders.length === 0) return <p className="rounded-2xl border border-cocoa/10 bg-white p-4 text-cocoa-soft">{empty}</p>;
  return (
    <ul className="divide-y divide-cocoa/10 overflow-hidden rounded-2xl border border-cocoa/10 bg-white">
      {orders.map((order) => (
        <OrderRow key={order.id} order={order} showStore={showStore} />
      ))}
    </ul>
  );
}
