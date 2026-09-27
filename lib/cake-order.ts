// Home cake builder helpers (stage 07). The database checks the real schedule.

const DAY_MS = 24 * 60 * 60 * 1000;

// First day that can meet the lead time ("YYYY-MM-DD", Campo Grande dates).
export function minCakeDate(today: string, leadTimeHours: number): string {
  const days = Math.ceil(leadTimeHours / 24);
  return new Date(Date.parse(`${today}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export type CakeRequest = {
  name: string;
  weightKg: number;
  format: string;
  addons: string[];
  fulfillment: string;
  date: string;
};

// WhatsApp text for a cake whose price is still pending (AD-012).
export function cakeWhatsappMessage(request: CakeRequest): string {
  const [year, month, day] = request.date.split("-");
  const details = [`${String(request.weightKg).replace(".", ",")} kg`, request.format, ...request.addons].join(" · ");
  return [
    "Olá, Cake 67! Quero encomendar um bolo:",
    `${request.name} · ${details}`,
    `${request.fulfillment}${request.date ? ` · ${day}/${month}/${year}` : ""}`,
    "Pode me passar o valor?",
  ].join("\n");
}
