import { describe, expect, it } from "vitest";
import { centsToInput, parseBRL } from "@/lib/money";
import { formatWhatsapp, normalizeWhatsapp } from "@/lib/phone";
import { nextFreeSlug, slugify } from "@/lib/slug";

describe("parseBRL", () => {
  it.each([
    ["24,9", 2490],
    ["24,90", 2490],
    ["R$ 24,90", 2490],
    ["r$24", 2400],
    ["1.234,56", 123456],
    ["1234,5", 123450],
    ["0", 0],
  ])("parses %s as %i cents", (text, cents) => {
    expect(parseBRL(text)).toBe(cents);
  });

  it.each(["", "abc", "-5", "24,999", "24.90", "1.23,00"])("rejects %j", (text) => {
    expect(parseBRL(text)).toBeNull();
  });

  it("formats cents for inputs", () => {
    expect(centsToInput(2490)).toBe("24,90");
    expect(centsToInput(0)).toBe("0,00");
  });
});

describe("slugify", () => {
  it("strips accents and symbols", () => {
    expect(slugify("Água com Gás!")).toBe("agua-com-gas");
    expect(slugify("  Bolo  Prestígio 2kg ")).toBe("bolo-prestigio-2kg");
  });

  it("finds the next free suffix", () => {
    expect(nextFreeSlug("agua", [])).toBe("agua");
    expect(nextFreeSlug("agua", ["agua", "agua-2"])).toBe("agua-3");
  });
});

describe("whatsapp", () => {
  it.each([
    ["(67) 98151-9796", "5567981519796"],
    ["67 9625-8783", "556796258783"],
    ["+55 67 98151-9796", "5567981519796"],
  ])("normalizes %s", (text, digits) => {
    expect(normalizeWhatsapp(text)).toBe(digits);
  });

  it.each(["981519796", "(67) 9815-19796-1", ""])("rejects %j", (text) => {
    expect(normalizeWhatsapp(text)).toBeNull();
  });

  it("formats back for display", () => {
    expect(formatWhatsapp("5567981519796")).toBe("(67) 98151-9796");
    expect(formatWhatsapp("556796258783")).toBe("(67) 9625-8783");
  });
});
