import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
  children: ReactNode;
};

// Label + control + hint/error. The control must use id={name}.
export function Field({ label, name, errors, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-cocoa">
        {label}
      </label>
      {children}
      {errors?.length ? (
        <p id={`${name}-error`} className="text-sm text-raspberry">
          {errors[0]}
        </p>
      ) : (
        hint && <p className="text-xs text-cocoa-soft">{hint}</p>
      )}
    </div>
  );
}

export function FormMessage({ state }: { state: { ok: boolean; message?: string } }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-xl px-4 py-3 text-sm ${state.ok ? "bg-olive/10 text-olive-dark" : "bg-raspberry/10 text-raspberry"}`}
    >
      {state.message}
    </p>
  );
}
