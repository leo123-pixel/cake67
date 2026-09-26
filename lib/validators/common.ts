import { z } from "zod";
import { parseBRL } from "@/lib/money";

export type FieldErrors = Record<string, string[]>;

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: FieldErrors;
};

export const requiredText = (message: string) => z.string().trim().min(1, message);

export const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null));

// HTML checkboxes send "on" when checked and nothing otherwise.
export const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on" || value === "true");

export const optionalUuid = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((value) => (value ? value : null));

export const moneyText = (message = "Informe um valor válido, ex. 24,90") =>
  z.string().transform((value, ctx) => {
    const cents = parseBRL(value);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return cents;
  });

// FormData -> plain object. Keys listed in arrayKeys keep every value.
export function readForm(formData: FormData, arrayKeys: string[] = []) {
  const data: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key).filter((v): v is string => typeof v === "string");
    data[key] = arrayKeys.includes(key) ? values : values[0];
  }
  for (const key of arrayKeys) data[key] ??= [];
  return data;
}

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

export function invalid(error: z.ZodError): ActionState {
  return { ok: false, message: "Confira os campos destacados.", fieldErrors: toFieldErrors(error) };
}
