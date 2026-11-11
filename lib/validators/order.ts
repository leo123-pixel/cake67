import { z } from "zod";
import { deliveryAddressSchema } from "@/lib/delivery/address";
import { normalizeWhatsapp } from "@/lib/phone";
import { isValidTaxId, normalizeTaxId } from "@/lib/tax-id";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value?.trim() ? value.trim().slice(0, max) : undefined));

export const orderItemSchema = z.object({
  product_id: z.uuid(),
  qty: z.number().int().min(1).max(2000),
  weight_kg: z.string().regex(/^\d{1,2}(\.\d)?$/).optional(),
  format: z.string().max(40).optional(),
  addon_ids: z.array(z.uuid()).max(10).optional(),
  message: z.string().max(60).optional(),
  piece_id: z.uuid().optional(),
});

export const orderItemsSchema = z.array(orderItemSchema).min(1).max(30);

export const checkoutSchema = z
  .object({
    name: z.string().trim().min(1, "Informe seu nome").max(80, "Use até 80 caracteres"),
    whatsapp: z.string().transform((text, ctx) => {
      const digits = normalizeWhatsapp(text);
      if (!digits) {
        ctx.addIssue({ code: "custom", message: "WhatsApp inválido, ex. (67) 99999-9999" });
        return z.NEVER;
      }
      return digits;
    }),
    fulfillment: z.enum(["retirada", "entrega"], { error: "Escolha retirada ou entrega" }),
    notes: optionalTrimmed(500),
    tax_id: z
      .string()
      .optional()
      .transform((text, ctx) => {
        if (!text?.trim()) return undefined;
        if (!isValidTaxId(text)) {
          ctx.addIssue({ code: "custom", message: "CPF ou CNPJ inválido" });
          return z.NEVER;
        }
        return normalizeTaxId(text);
      }),
    scheduled_for: z.iso.datetime({ offset: true }).optional().or(z.literal("").transform(() => undefined)),
    privacy: z.literal("on", { error: "É preciso aceitar o aviso de privacidade" }),
    // Stage 11: address in fields, required for delivery (checked below).
    delivery_street: z.string().optional(),
    delivery_number: z.string().optional(),
    delivery_complement: z.string().optional(),
    delivery_district: z.string().optional(),
    delivery_reference: z.string().optional(),
  })
  .transform((data, ctx) => {
    let delivery: z.output<typeof deliveryAddressSchema> | undefined;
    if (data.fulfillment === "entrega") {
      const parsed = deliveryAddressSchema.safeParse(data);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
        return z.NEVER;
      }
      delivery = parsed.data;
    }
    // `privacy` is only a gate; it is not sent to the database.
    return {
      name: data.name,
      whatsapp: data.whatsapp,
      fulfillment: data.fulfillment,
      ...delivery,
      notes: data.notes,
      tax_id: data.tax_id,
      scheduled_for: data.scheduled_for,
    };
  });

export type CheckoutInput = z.output<typeof checkoutSchema>;
