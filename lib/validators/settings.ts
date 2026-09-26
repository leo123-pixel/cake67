import { z } from "zod";
import { templateProblems } from "@/lib/whatsapp";
import { checkbox } from "./common";

export const RESERVATION_RANGE = { min: 15, max: 1440 } as const;

export function describeTemplateProblems(template: string): string | null {
  const { missing, unknown } = templateProblems(template);
  if (missing.length) return `A mensagem precisa ter ${missing.map((name) => `{${name}}`).join(" e ")}.`;
  if (unknown.length) return `Variável desconhecida: ${unknown.map((name) => `{${name}}`).join(", ")}.`;
  return null;
}

export const settingsSchema = z.object({
  reservation_minutes: z.coerce
    .number({ message: "Informe os minutos" })
    .int("Use minutos inteiros")
    .min(RESERVATION_RANGE.min, `Entre ${RESERVATION_RANGE.min} e ${RESERVATION_RANGE.max} minutos`)
    .max(RESERVATION_RANGE.max, `Entre ${RESERVATION_RANGE.min} e ${RESERVATION_RANGE.max} minutos`),
  order_whatsapp_template: z
    .string()
    .trim()
    .min(1, "Escreva a mensagem")
    .max(2000, "Até 2000 caracteres")
    .superRefine((template, ctx) => {
      const problem = describeTemplateProblems(template);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    }),
  privacy_text: z.string().trim().max(20000, "Até 20000 caracteres"),
  privacy_reviewed: checkbox,
});

export type SettingsInput = z.infer<typeof settingsSchema>;
