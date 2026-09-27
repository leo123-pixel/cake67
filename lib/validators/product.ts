import { z } from "zod";
import type { TablesInsert } from "@/lib/database.types";
import { parseBRL } from "@/lib/money";
import { checkbox, requiredText } from "./common";

const leadTime = z.coerce
  .number({ error: "Informe a antecedência em horas" })
  .int("Use horas inteiras")
  .min(0, "A antecedência não pode ser negativa");

const positiveInt = (message: string) => z.coerce.number({ error: message }).int(message).positive(message);

const common = {
  name: requiredText("Informe o nome"),
  category_id: z.uuid({ error: "Escolha a categoria" }),
  description: z.string().trim().default(""),
  price: z.string().trim().default(""),
  price_pending: checkbox,
  active: checkbox,
  store_ids: z.array(z.uuid()).default([]),
};

const vitrine = z.object({ ...common, type: z.literal("vitrine") });

const boloKg = z.object({
  ...common,
  type: z.literal("bolo_kg"),
  weights_kg: z
    .array(z.coerce.number().positive())
    .min(1, "Escolha pelo menos um peso"),
  formats: z
    .string()
    .default("")
    .transform((text) => text.split(",").map((f) => f.trim()).filter(Boolean))
    .pipe(z.array(z.string()).min(1, "Informe pelo menos um formato")),
  lead_time_hours: leadTime,
  addon_ids: z.array(z.uuid()).default([]),
});

const cento = z.object({
  ...common,
  type: z.literal("cento"),
  min_qty: positiveInt("Informe a quantidade mínima"),
  step_qty: positiveInt("Informe o passo"),
  lead_time_hours: leadTime,
});

const kit = z.object({
  ...common,
  type: z.literal("kit"),
  kit_contents: requiredText("Descreva o que vem no kit"),
  lead_time_hours: leadTime,
});

export const productSchema = z
  .discriminatedUnion("type", [vitrine, boloKg, cento, kit], {
    error: "Escolha o tipo do produto",
  })
  .superRefine((product, ctx) => {
    const cents = parseBRL(product.price);
    if (product.price_pending && product.price === "") return;
    if (cents === null) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Informe um preço válido, ex. 24,90" });
    }
  })
  .transform((product) => ({ ...product, price_cents: parseBRL(product.price) ?? 0 }));

export type ProductInput = z.output<typeof productSchema>;

type ProductRow = Omit<TablesInsert<"products">, "slug">;

// Maps validated input to columns, clearing fields that do not apply to the type.
export function toProductRow(input: ProductInput): ProductRow {
  const row: ProductRow = {
    name: input.name,
    category_id: input.category_id,
    description: input.description,
    type: input.type,
    price_cents: input.price_cents,
    price_pending: input.price_pending,
    active: input.active,
    store_ids: input.store_ids,
    weights_kg: [],
    formats: [],
    min_qty: null,
    step_qty: null,
    kit_contents: null,
  };

  switch (input.type) {
    case "bolo_kg":
      return { ...row, weights_kg: input.weights_kg, formats: input.formats, lead_time_hours: input.lead_time_hours };
    case "cento":
      return { ...row, min_qty: input.min_qty, step_qty: input.step_qty, lead_time_hours: input.lead_time_hours };
    case "kit":
      return { ...row, kit_contents: input.kit_contents, lead_time_hours: input.lead_time_hours };
    case "vitrine":
      return row;
  }
}
