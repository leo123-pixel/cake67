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

const whatsappField = z.string().transform((text, ctx) => {
  const digits = normalizeWhatsapp(text);
  if (!digits) {
    ctx.addIssue({ code: "custom", message: "WhatsApp inválido, ex. (67) 98151-9796" });
    return z.NEVER;
  }
  return digits;
});

const limited = (max: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value?.trim() ? value.trim().replace(/\s+/g, " ") : null))
    .refine((value) => value === null || value.length <= max, `Use até ${max} caracteres`);

// "<id>|<name>" from the Juma category select; empty = none (spec 11, D7).
const deliveryCategory = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value) return { delivery_category_id: null, delivery_category_name: null };
    const match = /^(\d{1,12})\|(.{1,80})$/.exec(value);
    if (!match) {
      ctx.addIssue({ code: "custom", message: "Categoria inválida" });
      return z.NEVER;
    }
    return { delivery_category_id: match[1], delivery_category_name: match[2] };
  });

export const storeSchema = z.object({
  name: requiredText("Informe o nome"),
  address: requiredText("Informe o endereço"),
  phone: optionalText,
  whatsapp_ready: whatsappField,
  whatsapp_made_to_order: whatsappField,
  whatsapp_support: whatsappField,
  active: checkbox,
  // Stage 11: origin of the delivery (Juma).
  address_street: limited(120),
  address_number: limited(20),
  address_district: limited(80),
  delivery_category: deliveryCategory,
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
