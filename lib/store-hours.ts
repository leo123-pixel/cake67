// Opening hours in words, as in the prototype: "Seg a sáb, 10h às 19h · Dom, 9h às 12h".
import { parseStoredHours, WEEK_DAYS } from "@/lib/validators/store";

const SHORT_DAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function time(value: string) {
  const [hour, minute] = value.split(":");
  return `${Number(hour)}h${minute === "00" ? "" : minute}`;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function dayRange(first: number, last: number) {
  if (first === last) return SHORT_DAYS[first];
  const joiner = last - first === 1 ? " e " : " a ";
  return `${SHORT_DAYS[first]}${joiner}${SHORT_DAYS[last]}`;
}

// Consecutive days with the same hours are grouped; closed days are omitted.
export function describeHours(stored: unknown): string {
  const hours = parseStoredHours(stored);
  const groups: { first: number; last: number; text: string }[] = [];

  WEEK_DAYS.forEach((day, index) => {
    const open = hours[day];
    if (!open) return;
    const text = `${time(open.open)} às ${time(open.close)}`;
    const previous = groups.at(-1);
    if (previous && previous.last === index - 1 && previous.text === text) previous.last = index;
    else groups.push({ first: index, last: index, text });
  });

  return groups.map((g) => `${capitalize(dayRange(g.first, g.last))}, ${g.text}`).join(" · ");
}
