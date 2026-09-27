// CSV for Excel in Portuguese: UTF-8 BOM, ";" separator, "1234,50" values.

const BOM = "﻿";
const SEPARATOR = ";";
// Excel runs cells starting with these as formulas (CSV injection).
const FORMULA_START = /^[=+\-@\t\r]/;

export type CsvValue = string | number | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(SEPARATOR));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

export function csvCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

// "26/09/2026 14:05" in Campo Grande.
export function csvDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Campo_Grande",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}
