// Guest calculator (SPEC §7): 10 slices per kg with 15% slack, as in the prototype.

const SLICES_PER_KG = 10;
const SLACK = 1.15;

export type CakeSuggestion = { weightKg: number; format: string | null; slices: number };

function formatByWeight(weightKg: number): string {
  if (weightKg <= 2) return "Redondo";
  if (weightKg <= 4.5) return "Retangular";
  return "Régua";
}

// Smallest offered weight that feeds everyone (largest if none does), and the
// prototype's format rule restricted to the formats this cake offers.
export function suggestCake(guests: number, weights: number[], formats: string[]): CakeSuggestion | null {
  if (!Number.isFinite(guests) || guests < 1 || weights.length === 0) return null;

  const needed = Math.ceil((guests * SLACK) / SLICES_PER_KG * 2) / 2;
  const sorted = [...weights].sort((a, b) => a - b);
  const weightKg = sorted.find((w) => w >= needed) ?? sorted[sorted.length - 1];

  const preferred = formatByWeight(weightKg);
  const format = formats.includes(preferred) ? preferred : (formats[0] ?? null);

  return { weightKg, format, slices: Math.round(weightKg * SLICES_PER_KG) };
}
