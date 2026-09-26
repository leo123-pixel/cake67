"use client";

import Link from "next/link";
import { SortableList } from "@/components/admin/sortable-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { AdminHighlightRow, HighlightStatus } from "@/lib/admin/highlights";
import { HIGHLIGHT_SLOT_LABELS } from "@/lib/validators/highlight";
import { reorderItems } from "../reorder-action";

const STATUS: Record<HighlightStatus, { label: string; tone: "green" | "amber" | "gray" }> = {
  vigente: { label: "Vigente", tone: "green" },
  agendado: { label: "Agendado", tone: "amber" },
  encerrado: { label: "Encerrado", tone: "gray" },
  inativo: { label: "Inativo", tone: "gray" },
};

export function HighlightsList({ highlights }: { highlights: AdminHighlightRow[] }) {
  return (
    <SortableList
      items={highlights}
      label={(h) => h.title}
      onReorder={(ids) => reorderItems("highlights", ids)}
      renderItem={(h) => (
        <Link href={`/admin/destaques/${h.id}`} className="block space-y-1 py-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-olive">{h.title}</span>
            <StatusBadge tone={STATUS[h.status].tone}>{STATUS[h.status].label}</StatusBadge>
          </span>
          <span className="block text-sm text-cocoa-soft">
            {HIGHLIGHT_SLOT_LABELS[h.slot]}
            {h.productName && ` · ${h.productName}`}
          </span>
        </Link>
      )}
    />
  );
}
