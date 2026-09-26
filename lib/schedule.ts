// Pickup/delivery slots for made-to-order items, in Campo Grande time.
import { isoToLocalInput, localInputToIso } from "@/lib/datetime";
import { WEEK_DAYS, type StoreHours } from "@/lib/validators/store";

export type ScheduleDay = { date: string; slots: { time: string; iso: string }[] };

const DAY_MS = 24 * 60 * 60 * 1000;

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// Weekday key of a "YYYY-MM-DD" date (calendar arithmetic, timezone-free).
function weekDay(date: string) {
  const index = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return WEEK_DAYS[index];
}

function addDays(date: string, days: number) {
  return new Date(new Date(`${date}T12:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

// Days (from the earliest allowed moment) with slots every `step` minutes
// while the store is open (open <= slot < close). Closed days are skipped.
export function buildSlots(hours: StoreHours, earliestIso: string, days = 14, step = 30): ScheduleDay[] {
  const earliest = new Date(earliestIso).getTime();
  const firstDate = isoToLocalInput(earliestIso).slice(0, 10);
  const result: ScheduleDay[] = [];

  for (let offset = 0; offset < days; offset++) {
    const date = addDays(firstDate, offset);
    const window = hours[weekDay(date)];
    if (!window) continue;

    const slots = [];
    for (let m = toMinutes(window.open); m < toMinutes(window.close); m += step) {
      const time = toTime(m);
      const iso = localInputToIso(`${date}T${time}`);
      if (new Date(iso).getTime() >= earliest) slots.push({ time, iso });
    }
    if (slots.length > 0) result.push({ date, slots });
  }

  return result;
}
