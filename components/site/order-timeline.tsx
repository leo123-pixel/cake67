import { formatPickup } from "@/lib/datetime";
import type { buildTimeline, TimelineStep } from "@/lib/order-timeline";

type Timeline = ReturnType<typeof buildTimeline>;
type ItemState = TimelineStep["state"] | "end";

const SCREEN_READER: Record<ItemState, string> = {
  done: "concluída",
  current: "em andamento",
  upcoming: "próxima",
  end: "",
};

const MARKER: Record<ItemState, string> = {
  done: "bg-olive text-linen",
  current: "border-2 border-olive bg-white ring-4 ring-olive/20",
  upcoming: "border-2 border-cocoa/25 bg-white",
  end: "bg-raspberry text-linen",
};

const LABEL: Record<ItemState, string> = {
  done: "text-cocoa",
  current: "font-medium text-olive",
  upcoming: "text-cocoa-soft",
  end: "font-medium text-raspberry",
};

// Customer-facing order progress (spec 09). Server-rendered, no client JS.
export function OrderTimeline({ timeline }: { timeline: Timeline }) {
  const items = [
    ...timeline.steps.map((step) => ({ key: step.key, label: step.label, at: step.at, state: step.state as ItemState })),
    ...(timeline.end ? [{ key: "end", label: timeline.end.label, at: timeline.end.at, state: "end" as const }] : []),
  ];

  // The step to announce as current; a delivered order points at its last step.
  const currentIndex = items.findIndex((item) => item.state === "current" || item.state === "end");
  const activeIndex = currentIndex === -1 ? items.length - 1 : currentIndex;

  return (
    <ol aria-label="Andamento do pedido" className="rounded-3xl border border-cocoa/10 bg-white p-5">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <li key={item.key} aria-current={index === activeIndex ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className={`absolute top-6 bottom-0 left-[11px] w-0.5 ${item.state === "done" ? "bg-olive" : "bg-cocoa/15"}`}
              />
            )}
            <span
              aria-hidden
              className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${MARKER[item.state]}`}
            >
              {item.state === "done" && "✓"}
              {item.state === "end" && "×"}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className={`block ${LABEL[item.state]}`}>
                {item.label}
                {SCREEN_READER[item.state] && <span className="sr-only"> ({SCREEN_READER[item.state]})</span>}
              </span>
              {item.at && <span className="block text-sm text-cocoa-soft">{formatPickup(item.at)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
