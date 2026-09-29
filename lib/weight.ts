import { todayInCampoGrande } from "@/lib/datetime";

// Weighed showcase cakes (stage 10). Weights are integer grams, like cents.
export const MIN_PIECE_GRAMS = 300;
export const MAX_PIECE_GRAMS = 10000;

// Accepts "1,340", "1.34", "1" (kg, up to 3 decimals). Returns grams, or null
// when the text is not a weight inside the accepted range.
export function parseKgToGrams(text: string): number | null {
  const cleaned = text.trim().replace(/\s*kg$/i, "").replace(",", ".");
  if (!/^\d{1,2}(\.\d{1,3})?$/.test(cleaned)) return null;
  const [kg, fraction = ""] = cleaned.split(".");
  const grams = Number(kg) * 1000 + Number(fraction.padEnd(3, "0"));
  return grams >= MIN_PIECE_GRAMS && grams <= MAX_PIECE_GRAMS ? grams : null;
}

// 1340 -> "1,34 kg", 1345 -> "1,345 kg", 1000 -> "1,00 kg".
export function formatKg(grams: number): string {
  const kg = (grams / 1000).toFixed(3).replace(/0$/, "");
  return `${kg.replace(".", ",")} kg`;
}

// 1340 -> "1,340" for a form input.
export function gramsToInput(grams: number): string {
  return (grams / 1000).toFixed(3).replace(".", ",");
}

// Same rounding as the database: round(price_cents * weight_g / 1000.0),
// half away from zero, in integer arithmetic.
export function piecePriceCents(pricePerKgCents: number, grams: number): number {
  return Math.floor((pricePerKgCents * grams + 500) / 1000);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar days in Campo Grande since the piece went to the showcase:
// "hoje", "1 dia", "3 dias".
export function daysOnShowcase(createdAtIso: string, now: Date = new Date()): string {
  const since = todayInCampoGrande(new Date(createdAtIso));
  const today = todayInCampoGrande(now);
  const days = Math.round((Date.parse(today) - Date.parse(since)) / DAY_MS);
  if (days <= 0) return "hoje";
  return days === 1 ? "1 dia" : `${days} dias`;
}
