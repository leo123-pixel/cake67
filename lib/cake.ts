// Cake sizes from the bakery's menu (SPEC §7). Each size has a weight range;
// the order is charged at the smallest offered weight inside the range and
// any extra found on the scale is paid at pickup.

export type CakeSize = {
  format: string;
  size: string | null;
  measure: string;
  minKg: number;
  maxKg: number;
  serves: number;
};

export const CAKE_SIZES: CakeSize[] = [
  { format: "Redondo", size: "Mini", measure: "13 cm", minKg: 1, maxKg: 1.4, serves: 10 },
  { format: "Redondo", size: "P", measure: "15 cm", minKg: 1.5, maxKg: 1.9, serves: 15 },
  { format: "Redondo", size: "M", measure: "17 cm", minKg: 2, maxKg: 2.4, serves: 18 },
  { format: "Redondo", size: "G", measure: "20 cm", minKg: 2.5, maxKg: 3, serves: 25 },
  { format: "Redondo", size: "GG", measure: "25 cm", minKg: 3.5, maxKg: 4, serves: 35 },
  { format: "Régua", size: null, measure: "25×10 cm", minKg: 2.3, maxKg: 2.5, serves: 15 },
  { format: "Retangular", size: "P", measure: "20×30 cm", minKg: 4, maxKg: 4.5, serves: 40 },
  { format: "Retangular", size: "M", measure: "26×35 cm", minKg: 5.5, maxKg: 6.5, serves: 60 },
  { format: "Retangular", size: "G", measure: "26×37 cm", minKg: 7.5, maxKg: 8, serves: 70 },
];

// A size the cake can be ordered in: weightKg is what the order is charged at.
export type CakeOption = { size: CakeSize; weightKg: number };

export type CakeSuggestion = { options: CakeOption[]; serves: number };

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

export function kgText(weight: number) {
  return String(weight).replace(".", ",");
}

export function sizeName(size: CakeSize) {
  return size.size ? `${size.format} ${size.size}` : size.format;
}

export function rangeText(size: CakeSize) {
  return `${kgText(size.minKg)} a ${kgText(size.maxKg)} kg`;
}

function chargedWeight(size: CakeSize, weights: number[]): number | null {
  const inRange = weights.filter((w) => w >= size.minKg && w <= size.maxKg);
  return inRange.length ? Math.min(...inRange) : null;
}

// Sizes of one format this cake can be ordered in, smallest first.
export function formatOptions(format: string, weights: number[]): CakeOption[] {
  return CAKE_SIZES.filter((size) => normalize(size.format) === normalize(format))
    .map((size) => ({ size, weightKg: chargedWeight(size, weights) }))
    .filter((option): option is CakeOption => option.weightKg !== null);
}

// Weights to offer for a format: one per menu size, or every weight when the
// format has no size in the menu.
export function weightChoices(format: string, weights: number[]): number[] {
  const options = formatOptions(format, weights);
  return options.length ? options.map((o) => o.weightKg) : weights;
}

export function keepWeight(format: string, weights: number[], current: number): number {
  const choices = weightChoices(format, weights);
  return choices.includes(current) ? current : choices[0];
}

export function sizeFor(format: string, weightKg: number): CakeSize | null {
  return (
    CAKE_SIZES.find((s) => normalize(s.format) === normalize(format) && weightKg >= s.minKg && weightKg <= s.maxKg) ?? null
  );
}

// Smallest size that serves everyone; sizes serving the same count are
// alternatives (e.g. Redondo P or Régua for 15). Past the biggest, the biggest.
export function suggestCake(guests: number, weights: number[], formats: string[]): CakeSuggestion | null {
  if (!Number.isFinite(guests) || guests < 1) return null;

  const options = formats.flatMap((format) => formatOptions(format, weights));
  if (options.length === 0) return null;

  const counts = [...new Set(options.map((o) => o.size.serves))].sort((a, b) => a - b);
  const serves = counts.find((n) => n >= guests) ?? counts[counts.length - 1];
  const chosen = options.filter((o) => o.size.serves === serves).sort((a, b) => a.weightKg - b.weightKg);
  return { options: chosen, serves };
}

export function minimumChargeNote(size: CakeSize, weightKg: number) {
  return `Pesa de ${rangeText(size)}: cobramos o peso mínimo (${kgText(weightKg)} kg) e, se na pesagem passar disso, a diferença é cobrada na retirada.`;
}
