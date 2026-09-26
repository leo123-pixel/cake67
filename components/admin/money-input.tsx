import { centsToInput } from "@/lib/money";

type Props = {
  name: string;
  defaultCents?: number | null;
  invalid?: boolean;
  required?: boolean;
};

// Plain text so "24,90" and "R$ 24,90" both work; parsed on the server.
export function MoneyInput({ name, defaultCents, invalid, required }: Props) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-cocoa-soft">R$</span>
      <input
        id={name}
        name={name}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        defaultValue={defaultCents == null ? "" : centsToInput(defaultCents)}
        required={required}
        aria-invalid={invalid}
        className="field-input pl-10"
      />
    </div>
  );
}
