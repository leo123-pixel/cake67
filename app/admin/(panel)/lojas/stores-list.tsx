"use client";

import Link from "next/link";
import { SortableList } from "@/components/admin/sortable-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { AdminStore } from "@/lib/admin/catalog";
import { formatWhatsapp } from "@/lib/phone";
import { reorderItems } from "../reorder-action";

export function StoresList({ stores }: { stores: AdminStore[] }) {
  return (
    <SortableList
      items={stores}
      label={(store) => store.name}
      onReorder={(ids) => reorderItems("stores", ids)}
      renderItem={(store) => (
        <Link href={`/admin/lojas/${store.id}`} className="block space-y-1 py-1">
          <span className="flex items-center gap-2">
            <span className="font-medium text-olive">{store.name}</span>
            {!store.active && <StatusBadge tone="gray">Inativa</StatusBadge>}
          </span>
          <span className="block text-sm text-cocoa-soft">{store.address}</span>
          <span className="block text-sm text-cocoa-soft">WhatsApp {formatWhatsapp(store.whatsapp)}</span>
        </Link>
      )}
    />
  );
}
