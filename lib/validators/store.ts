import { z } from "zod";
import { normalizeWhatsapp } from "@/lib/phone";
import { checkbox, optionalText, requiredText } from "./common";

export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato 10:00");

const openDay = z
  .object({ open: time, close: time })
  .refine((day) => day.close > day.open, {
    message: "O fechamento precisa ser depois da abertura",
    path: ["close"],
  });

export type StoreHours = Record<WeekDay, z.infer<typeof openDay> | null>;

export const storeSchema = z.object({
  name: requiredText("Informe o nome"),
  address: requiredText("Informe o endereço"),
  phone: optionalText,
  whatsapp: z.string().transform((text, ctx) => {
    const digits = normalizeWhatsapp(text);
    if (!digits) {
      ctx.addIssue({ code: "custom", message: "WhatsApp inválido, ex. (67) 98151-9796" });
      return z.NEVER;
    }
    return digits;
  }),
  active: checkbox,
  hours: z.object(
    Object.fromEntries(WEEK_DAYS.map((day) => [day, openDay.nullable()])) as Record<
      WeekDay,
      z.ZodNullable<typeof openDay>
    >,
  ),
});

// Form fields "<day>_closed", "<day>_open", "<day>_close" -> hours object.
export function readHours(data: Record<string, unknown>) {
  return Object.fromEntries(
    WEEK_DAYS.map((day) => [
      day,
      data[`${day}_closed`] === "on" ? null : { open: data[`${day}_open`], close: data[`${day}_close`] },
    ]),
  );
}

export function parseStoredHours(value: unknown): StoreHours {
  const source = (value ?? {}) as Record<string, unknown>;
  const result = openDay.nullable();
  return Object.fromEntries(
    WEEK_DAYS.map((day) => {
      const parsed = result.safeParse(source[day] ?? null);
      return [day, parsed.success ? parsed.data : null];
    }),
  ) as StoreHours;
}
