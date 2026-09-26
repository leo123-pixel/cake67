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

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}
