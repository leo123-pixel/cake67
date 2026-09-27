import { describe, expect, it } from "vitest";
import { formatBRL } from "@/lib/money";

describe("formatBRL", () => {
  it.each([
    [2200, "R$ 22,00"],
    [2490, "R$ 24,90"],
    [0, "R$ 0,00"],
    [123456, "R$ 1.234,56"],
  ])("formats %i cents as %s", (cents, expected) => {
    expect(formatBRL(cents)).toBe(expected);
  });
});
