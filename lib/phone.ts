// Brazilian WhatsApp numbers stored as digits with country code: 55 + DDD + 8/9 digits.

export function normalizeWhatsapp(text: string): string | null {
  let digits = text.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : null;
}

export function formatWhatsapp(digits: string): string {
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = local.slice(0, 2);
  const number = local.slice(2);
  const split = number.length - 4;
  return `(${ddd}) ${number.slice(0, split)}-${number.slice(split)}`;
}
