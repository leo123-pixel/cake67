import { describe, expect, it } from "vitest";
import { daysOnShowcase, formatKg, gramsToInput, parseKgToGrams, piecePriceCents } from "@/lib/weight";

describe("parseKgToGrams", () => {
  it.each([
    ["1,340", 1340],
    ["1.34", 1340],
    ["1", 1000],
    [" 2,5 kg ", 2500],
    ["0,300", 300],
    ["10", 10000],
    ["10,000", 10000],
  ])("reads %s as %i g", (text, grams) => {
    expect(parseKgToGrams(text)).toBe(grams);
  });

  it.each(["0,299", "10,001", "", "abc", "1,3456", "1.234,5", "-1", "100"])("refuses %s", (text) => {
    expect(parseKgToGrams(text)).toBeNull();
  });
});

describe("formatKg", () => {
  it.each([
    [1340, "1,34 kg"],
    [1345, "1,345 kg"],
    [1000, "1,00 kg"],
    [300, "0,30 kg"],
  ])("formats %i g as %s", (grams, text) => {
    expect(formatKg(grams)).toBe(text);
  });

  it("formats the input value with three decimals", () => {
    expect(gramsToInput(1340)).toBe("1,340");
  });
});

describe("piecePriceCents", () => {
  it.each([
    [11000, 1340, 14740],
    [12345, 1005, 12407], // 12406.725 rounds up
    [9990, 1500, 14985],
    [1, 500, 1], // 0.5 rounds half away from zero, like Postgres
  ])("%i/kg × %i g = %i cents", (price, grams, cents) => {
    expect(piecePriceCents(price, grams)).toBe(cents);
  });
});

describe("daysOnShowcase", () => {
  const now = new Date("2026-09-29T15:00:00-04:00");

  it("counts calendar days in Campo Grande", () => {
    expect(daysOnShowcase("2026-09-29T00:30:00-04:00", now)).toBe("hoje");
    expect(daysOnShowcase("2026-09-28T23:59:00-04:00", now)).toBe("1 dia");
    expect(daysOnShowcase("2026-09-26T10:00:00-04:00", now)).toBe("3 dias");
  });

  it("uses local midnight, not UTC", () => {
    // 02:00 UTC on the 29th is still the 28th in Campo Grande.
    expect(daysOnShowcase("2026-09-29T02:00:00Z", now)).toBe("1 dia");
  });
});
