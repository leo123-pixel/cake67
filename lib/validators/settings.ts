import { z } from "zod";
import { CONFIRMATION_TEMPLATE, ORDER_TEMPLATE, templateProblems, type TemplateSpec } from "@/lib/whatsapp";
import { checkbox } from "./common";

export const RESERVATION_RANGE = { min: 15, max: 1440 } as const;

export function describeTemplateProblems(template: string, spec: TemplateSpec): string | null {
  const { missing, unknown } = templateProblems(template, spec);
  if (missing.length) return `A mensagem precisa ter ${missing.map((name) => `{${name}}`).join(" e ")}.`;
  if (unknown.length) return `Variável desconhecida: ${unknown.map((name) => `{${name}}`).join(", ")}.`;
  return null;
}

// Browsers submit textarea line breaks as CRLF; store plain "\n".
const multiline = z.string().transform((text) => text.replace(/\r\n?/g, "\n").trim());

function templateField(spec: TemplateSpec) {
  return multiline.pipe(
    z
      .string()
      .min(1, "Escreva a mensagem")
      .max(2000, "Até 2000 caracteres")
      .superRefine((template, ctx) => {
        const problem = describeTemplateProblems(template, spec);
        if (problem) ctx.addIssue({ code: "custom", message: problem });
      }),
  );
}

export const settingsSchema = z.object({
  reservation_minutes: z.coerce
    .number({ message: "Informe os minutos" })
    .int("Use minutos inteiros")
    .min(RESERVATION_RANGE.min, `Entre ${RESERVATION_RANGE.min} e ${RESERVATION_RANGE.max} minutos`)
    .max(RESERVATION_RANGE.max, `Entre ${RESERVATION_RANGE.min} e ${RESERVATION_RANGE.max} minutos`),
  order_whatsapp_template: templateField(ORDER_TEMPLATE),
  confirmation_whatsapp_template: templateField(CONFIRMATION_TEMPLATE),
  privacy_text: multiline.pipe(z.string().max(20000, "Até 20000 caracteres")),
  privacy_reviewed: checkbox,
});

export type SettingsInput = z.infer<typeof settingsSchema>;
