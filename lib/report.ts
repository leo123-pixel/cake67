// Report periods and data shapes (AD-011). Dates are "YYYY-MM-DD" in Campo Grande.

export const PERIOD_PRESETS = {
  hoje: "Hoje",
  "7d": "7 dias",
  mes: "Este mês",
  mes_passado: "Mês passado",
  personalizado: "De/até",
} as const;

export type PeriodPreset = keyof typeof PERIOD_PRESETS;

export const PRODUCT_TYPE_LABELS = {
  vitrine: "Vitrine",
  vitrine_kg: "Bolo inteiro (vitrine)",
  bolo_kg: "Bolo por kg",
  cento: "Cento",
  kit: "Kit",
} as const;

export const MAX_PERIOD_DAYS = 400;
// Longer periods list only the days that had orders.
const MAX_FILLED_DAYS = 62;

export type Period = { preset: PeriodPreset; from: string; to: string; notice?: string };

export type ReportTotals = {
  orders: number;
  revenue_cents: number;
  avg_ticket_cents: number | null;
  cancelled: { count: number; cents: number };
  expired: { count: number; cents: number };
  pending: { count: number; cents: number };
};

export type ReportDay = { day: string; orders: number; revenue_cents: number };

export type Report = {
  totals: ReportTotals;
  by_day: ReportDay[];
  by_store: { store_id: string; name: string; orders: number; revenue_cents: number; avg_ticket_cents: number }[];
  top_products: {
    product_id: string | null;
    name: string;
    type: "vitrine" | "vitrine_kg" | "bolo_kg" | "cento" | "kit";
    units: number;
    kg: number | null;
    revenue_cents: number;
  }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toTime(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromTime(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function isDate(value: string | undefined): value is string {
  return Boolean(value && DATE_ONLY.test(value) && fromTime(toTime(value)) === value);
}

export function addDays(date: string, days: number): string {
  return fromTime(toTime(date) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toTime(to) - toTime(from)) / DAY_MS);
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function isPreset(value: string | undefined): value is PeriodPreset {
  return Boolean(value && value in PERIOD_PRESETS);
}

export function resolvePeriod(preset: string | undefined, from: string | undefined, to: string | undefined, today: string): Period {
  switch (isPreset(preset) ? preset : "mes") {
    case "hoje":
      return { preset: "hoje", from: today, to: today };
    case "7d":
      return { preset: "7d", from: addDays(today, -6), to: today };
    case "mes_passado": {
      const end = addDays(monthStart(today), -1);
      return { preset: "mes_passado", from: monthStart(end), to: end };
    }
    case "personalizado":
      if (isDate(from) && isDate(to) && from <= to && daysBetween(from, to) <= MAX_PERIOD_DAYS) {
        return { preset: "personalizado", from, to };
      }
      return {
        preset: "mes",
        from: monthStart(today),
        to: today,
        notice: `Período inválido (até ${MAX_PERIOD_DAYS} dias, início antes do fim). Mostrando este mês.`,
      };
    case "mes":
      return { preset: "mes", from: monthStart(today), to: today };
  }
}

// Every day of the period, with zeros where there were no orders.
export function fillDays(byDay: ReportDay[], from: string, to: string): ReportDay[] {
  if (daysBetween(from, to) >= MAX_FILLED_DAYS) return byDay;
  const known = new Map(byDay.map((day) => [day.day, day]));
  const days: ReportDay[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(known.get(day) ?? { day, orders: 0, revenue_cents: 0 });
  }
  return days;
}
