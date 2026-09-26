const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, " ");
}

// Accepts "24,9", "24,90", "R$ 24,90", "1.234,56". Returns cents, or null when
// the text is not a non-negative amount with at most two decimals.
export function parseBRL(text: string): number | null {
  const cleaned = text.replace(/R\$/i, "").replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(cleaned)) return null;

  const [reais, centavos = ""] = cleaned.replace(/\./g, "").split(",");
  return Number(reais) * 100 + Number(centavos.padEnd(2, "0"));
}

// Cents to the value shown in a form input: 2490 -> "24,90".
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
