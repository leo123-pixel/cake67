// CPF (11 digits) and CNPJ (14 digits). Mirrors public.is_valid_tax_id in SQL.

export function normalizeTaxId(text: string): string {
  return text.replace(/\D/g, "");
}

function digits(value: string) {
  return [...value].map(Number);
}

export function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const d = digits(value);
  const check = (length: number) => {
    const sum = d.slice(0, length).reduce((acc, n, i) => acc + n * (length + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === d[9] && check(10) === d[10];
}

export function isValidCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const d = digits(value);
  const check = (weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + d[i] * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return (
    check([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === d[12] &&
    check([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === d[13]
  );
}

export function isValidTaxId(text: string): boolean {
  const value = normalizeTaxId(text);
  return value.length === 11 ? isValidCpf(value) : isValidCnpj(value);
}

export function formatTaxId(value: string): string {
  if (value.length === 11) return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (value.length === 14) return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return value;
}
