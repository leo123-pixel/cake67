import { centsToInput } from "@/lib/money";

type Props = {
  name: string;
  id?: string;
  defaultCents?: number | null;
  // Raw text, e.g. echoed back after a failed submit; wins over defaultCents.
  defaultValue?: string;
  invalid?: boolean;
  required?: boolean;
};

// Plain text so "24,90" and "R$ 24,90" both work; parsed on the server.
export function MoneyInput({ name, id = name, defaultCents, defaultValue, invalid, required }: Props) {
  const initial = defaultValue ?? (defaultCents == null ? "" : centsToInput(defaultCents));
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-cocoa-soft">R$</span>
      <input
        id={id}
        name={name}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        defaultValue={initial}
        required={required}
        aria-invalid={invalid}
        className="field-input pl-10"
      />
    </div>
  );
}
