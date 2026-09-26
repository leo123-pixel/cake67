import { describe, expect, it } from "vitest";
import { todayInCampoGrande } from "@/lib/datetime";
import { canCancel, CANCEL_REASONS, minutesLeft, nextStatuses, STATUS_LABELS } from "@/lib/order-status";

describe("nextStatuses", () => {
  it.each([
    ["novo", false, ["confirmado"]],
    ["confirmado", false, ["pronto", "entregue"]],
    ["confirmado", true, ["em_producao"]],
    ["em_producao", true, ["pronto"]],
    ["pronto", true, ["entregue"]],
    ["entregue", false, []],
    ["cancelado", false, []],
    ["expirado", false, []],
  ] as const)("%s (made to order: %s) -> %j", (status, mto, expected) => {
    expect(nextStatuses(status, mto)).toEqual(expected);
  });
});

describe("canCancel", () => {
  it("allows open orders only", () => {
    expect(["novo", "confirmado", "em_producao", "pronto"].every((s) => canCancel(s as never))).toBe(true);
    expect(["entregue", "cancelado", "expirado"].some((s) => canCancel(s as never))).toBe(false);
  });
});

describe("minutesLeft", () => {
  const now = new Date("2026-09-26T12:00:00.000Z");
  it("counts whole minutes and stops at zero", () => {
    expect(minutesLeft("2026-09-26T12:29:10.000Z", now)).toBe(30);
    expect(minutesLeft("2026-09-26T11:00:00.000Z", now)).toBe(0);
    expect(minutesLeft(null, now)).toBeNull();
  });
});

describe("labels", () => {
  it("covers every status and has an 'Outro' reason", () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(7);
    expect(CANCEL_REASONS).toContain("Outro");
  });

  it("gives today's date in Campo Grande", () => {
    // 02:30 UTC is still the previous day in Campo Grande (UTC-4).
    expect(todayInCampoGrande(new Date("2026-09-27T02:30:00.000Z"))).toBe("2026-09-26");
  });
});

describe("formatSince", async () => {
  const { formatSince } = await import("@/lib/datetime");
  const now = new Date("2026-09-26T15:00:00.000Z");
  it.each([
    ["2026-09-26T14:59:40.000Z", "agora"],
    ["2026-09-26T14:55:00.000Z", "há 5 min"],
    ["2026-09-26T12:00:00.000Z", "há 3 h"],
  ])("%s -> %s", (iso, text) => {
    expect(formatSince(iso, now)).toBe(text);
  });
});
