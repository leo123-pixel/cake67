"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useId, useState, useTransition } from "react";
import type { ActionState } from "@/lib/validators/common";

type Props<T extends { id: string }> = {
  items: T[];
  label: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  onReorder: (ids: string[]) => Promise<ActionState>;
};

// Reorders by dragging the handle (mouse or touch) or with ↑/↓, then saves.
export function SortableList<T extends { id: string }>({ items, label, renderItem, onReorder }: Props<T>) {
  const [order, setOrder] = useState(items);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Stable id: dnd-kit's default counter differs between server and client.
  const dndId = useId();

  useEffect(() => setOrder(items), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function save(next: T[]) {
    const previous = order;
    setOrder(next);
    setError(null);
    startTransition(async () => {
      const result = await onReorder(next.map((item) => item.id));
      if (!result.ok) {
        setOrder(previous);
        setError(result.message ?? "Não foi possível salvar a ordem.");
      }
    });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    save(arrayMove(order, index, target));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = order.findIndex((item) => item.id === active.id);
    const to = order.findIndex((item) => item.id === over.id);
    save(arrayMove(order, from, to));
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm text-raspberry">
          {error}
        </p>
      )}
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <ul className={`space-y-2 ${pending ? "opacity-70" : ""}`}>
            {order.map((item, index) => (
              <SortableRow
                key={item.id}
                id={item.id}
                label={label(item)}
                canUp={index > 0}
                canDown={index < order.length - 1}
                onUp={() => move(index, -1)}
                onDown={() => move(index, 1)}
              >
                {renderItem(item)}
              </SortableRow>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

type RowProps = {
  id: string;
  label: string;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  children: React.ReactNode;
};

function SortableRow({ id, label, canUp, canDown, onUp, onDown, children }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-2 rounded-2xl border border-cocoa/10 bg-white p-3 ${isDragging ? "relative z-10 shadow-lg" : ""}`}
    >
      <div className="flex shrink-0 flex-col items-center">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Arrastar ${label}`}
          className="flex size-11 touch-none cursor-grab items-center justify-center rounded-xl text-cocoa-soft hover:bg-cocoa/5"
        >
          ⠿
        </button>
        <button type="button" onClick={onUp} disabled={!canUp} aria-label={`Subir ${label}`} className="size-9 rounded-lg text-cocoa-soft disabled:opacity-30">
          ↑
        </button>
        <button type="button" onClick={onDown} disabled={!canDown} aria-label={`Descer ${label}`} className="size-9 rounded-lg text-cocoa-soft disabled:opacity-30">
          ↓
        </button>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
