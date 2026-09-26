// Campo Grande (America/Campo_Grande) is UTC-4 with no DST since 2019.
const CAMPO_GRANDE_OFFSET = "-04:00";
const TIME_ZONE = "America/Campo_Grande";

// "2026-09-26T10:00" from <input type="datetime-local"> -> ISO with offset.
export function localInputToIso(value: string): string {
  return new Date(`${value}:00${CAMPO_GRANDE_OFFSET}`).toISOString();
}

// ISO -> "2026-09-26T10:00" for <input type="datetime-local">.
export function isoToLocalInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Today's date ("YYYY-MM-DD") in Campo Grande.
export function todayInCampoGrande(now: Date = new Date()): string {
  return isoToLocalInput(now.toISOString()).slice(0, 10);
}

// "2026-09-26" -> start of that day in Campo Grande, as ISO. null if invalid.
export function dayStartIso(date: string | undefined): string | null {
  if (!date || !DATE_ONLY.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00${CAMPO_GRANDE_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// Exclusive upper bound that includes the whole given day.
export function dayEndExclusiveIso(date: string | undefined): string | null {
  const start = dayStartIso(date);
  return start ? new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000).toISOString() : null;
}

// "27/09 às 15h" / "27/09 às 15h30" (message and order summary style).
export function formatPickup(iso: string): string {
  const [date, time] = isoToLocalInput(iso).split("T");
  const [, month, day] = date.split("-");
  const [hour, minute] = time.split(":");
  return `${day}/${month} às ${Number(hour)}h${minute === "00" ? "" : minute}`;
}

// "2026-09-28" -> "seg., 28/09".
export function formatWeekdayDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${date}T12:00:00${CAMPO_GRANDE_OFFSET}`));
}

// "agora", "há 5 min", "há 3 h", else the date and time.
export function formatSince(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 24 * 60) return `há ${Math.floor(minutes / 60)} h`;
  return formatDateTime(iso);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}
