import { z } from "zod";
import { localInputToIso } from "@/lib/datetime";
import { checkbox, optionalText, optionalUuid, requiredText } from "./common";

export const HIGHLIGHT_SLOT_LABELS = {
  bolo_do_mes: "Bolo do Mês",
  combo_semana: "Combo da Semana",
  banner: "Banner",
} as const;

const optionalDateTime = z
  .string()
  .optional()
  .transform((value) => (value ? localInputToIso(value) : null));

export const HIGHLIGHT_IMAGE_PATH = /^highlights\/[0-9a-f-]{36}\.webp$/;

export function isAllowedHref(href: string): boolean {
  return /^\/(?!\/)/.test(href) || /^https:\/\/[^\s]+$/.test(href);
}

export const highlightSchema = z
  .object({
    slot: z.enum(["bolo_do_mes", "combo_semana", "banner"], { error: "Escolha o espaço" }),
    title: requiredText("Informe o título"),
    subtitle: optionalText,
    product_id: optionalUuid,
    image_path: optionalText,
    cta_label: optionalText,
    cta_href: optionalText,
    starts_at: optionalDateTime,
    ends_at: optionalDateTime,
    active: checkbox,
  })
  .superRefine((h, ctx) => {
    if (h.image_path && !HIGHLIGHT_IMAGE_PATH.test(h.image_path)) {
      ctx.addIssue({ code: "custom", path: ["image_path"], message: "Imagem inválida, envie de novo" });
    }
    if (h.cta_href && !isAllowedHref(h.cta_href)) {
      ctx.addIssue({ code: "custom", path: ["cta_href"], message: "Use um caminho do site (/cardapio) ou um link https://" });
    }
    if (Boolean(h.cta_label) !== Boolean(h.cta_href)) {
      ctx.addIssue({ code: "custom", path: ["cta_label"], message: "Preencha o texto e o link do botão, ou nenhum dos dois" });
    }
    if (h.starts_at && h.ends_at && h.ends_at <= h.starts_at) {
      ctx.addIssue({ code: "custom", path: ["ends_at"], message: "O fim precisa ser depois do início" });
    }
  });
