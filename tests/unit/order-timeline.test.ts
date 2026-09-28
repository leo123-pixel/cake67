import { describe, expect, it } from "vitest";
import { buildTimeline, type OrderEvent, type TimelineOrder } from "@/lib/order-timeline";

const CREATED = "2026-09-28T18:32:00Z";
const at = (hour: number) => `2026-09-28T${String(hour).padStart(2, "0")}:00:00Z`;

function order(overrides: Partial<TimelineOrder> & { events: OrderEvent[] }): TimelineOrder {
  return { status: "novo", created_at: CREATED, has_made_to_order: false, fulfillment: "retirada", ...overrides };
}

const summary = (timeline: ReturnType<typeof buildTimeline>) => timeline.steps.map((s) => [s.label, s.state, s.at]);

describe("buildTimeline", () => {
  it("a new vitrine order has 4 steps, only the first reached", () => {
    const timeline = buildTimeline(order({ events: [{ status: "novo", at: CREATED }] }));
    expect(summary(timeline)).toEqual([
      ["Pedido recebido", "current", CREATED],
      ["Confirmado", "upcoming", null],
      ["Pronto para retirar", "upcoming", null],
      ["Retirado", "upcoming", null],
    ]);
    expect(timeline.end).toBeNull();
  });

  it("a skipped step counts as done without a time", () => {
    const timeline = buildTimeline(
      order({
        status: "entregue",
        events: [
          { status: "novo", at: CREATED },
          { status: "confirmado", at: at(19) },
          { status: "entregue", at: at(20) },
        ],
      }),
    );
    expect(summary(timeline)).toEqual([
      ["Pedido recebido", "done", CREATED],
      ["Confirmado", "done", at(19)],
      ["Pronto para retirar", "done", null],
      ["Retirado", "done", at(20)],
    ]);
  });

  it("a made-to-order order has 5 steps", () => {
    const timeline = buildTimeline(
      order({
        status: "em_producao",
        has_made_to_order: true,
        events: [
          { status: "novo", at: CREATED },
          { status: "confirmado", at: at(19) },
          { status: "em_producao", at: at(20) },
        ],
      }),
    );
    expect(timeline.steps.map((s) => s.label)).toEqual(["Pedido recebido", "Confirmado", "Em produção", "Pronto para retirar", "Retirado"]);
    expect(timeline.steps.find((s) => s.state === "current")?.key).toBe("em_producao");
  });

  it("delivery labels", () => {
    const timeline = buildTimeline(order({ status: "pronto", fulfillment: "entrega", events: [] }));
    expect(timeline.steps.map((s) => s.label).slice(-2)).toEqual(["Pronto para entrega", "Entregue"]);
  });

  it("a cancelled order stops where it was, with no upcoming steps", () => {
    const timeline = buildTimeline(
      order({
        status: "cancelado",
        events: [
          { status: "novo", at: CREATED },
          { status: "confirmado", at: at(19) },
          { status: "cancelado", at: at(20) },
        ],
      }),
    );
    expect(summary(timeline)).toEqual([
      ["Pedido recebido", "done", CREATED],
      ["Confirmado", "done", at(19)],
    ]);
    expect(timeline.end).toEqual({ label: "Pedido cancelado", at: at(20) });
  });

  it("an expired order ends after the first step", () => {
    const timeline = buildTimeline(
      order({
        status: "expirado",
        events: [
          { status: "novo", at: CREATED },
          { status: "expirado", at: at(20) },
        ],
      }),
    );
    expect(summary(timeline)).toEqual([["Pedido recebido", "done", CREATED]]);
    expect(timeline.end).toEqual({ label: "Reserva expirada", at: at(20) });
  });

  it("a reactivated order shows its current path, not the expiration", () => {
    const timeline = buildTimeline(
      order({
        status: "confirmado",
        events: [
          { status: "novo", at: CREATED },
          { status: "expirado", at: at(20) },
          { status: "confirmado", at: at(21) },
        ],
      }),
    );
    expect(summary(timeline).slice(0, 2)).toEqual([
      ["Pedido recebido", "done", CREATED],
      ["Confirmado", "current", at(21)],
    ]);
    expect(timeline.end).toBeNull();
  });
});
