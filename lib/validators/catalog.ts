import { z } from "zod";
import { checkbox, moneyText, requiredText } from "./common";

export const categorySchema = z.object({
  name: requiredText("Informe o nome"),
  kind: z.enum(["vitrine", "encomenda"], { error: "Escolha o tipo" }),
  active: checkbox,
});

export const addonSchema = z.object({
  name: requiredText("Informe o nome"),
  price_cents: moneyText(),
  active: checkbox,
});
