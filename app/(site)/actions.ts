"use server";

import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";
import type { FieldErrors } from "@/lib/validators/common";
import { toFieldErrors } from "@/lib/validators/common";
import { checkoutSchema, orderItemsSchema } from "@/lib/validators/order";

export type QuotedLine = {
  index: number;
  product_id: string | null;
  name: string;
  type: "vitrine" | "bolo_kg" | "cento" | "kit" | null;
  qty: number;
  unit_price_cents: number;
  total_cents: number;
  problem: "esgotado" | "indisponivel" | "invalido" | null;
  problem_text: string | null;
};

export type Quote = {
  store_available: boolean;
  lines: QuotedLine[];
  subtotal_cents: number;
  has_made_to_order: boolean;
  earliest_schedule: string | null;
  reservation_minutes: number;
};

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; message: string };

const FAILED = "Não foi possível atualizar o carrinho agora. Tente de novo.";

// Prices and availability for the cart, computed by the database.
export async function quoteCart(storeId: string, items: unknown): Promise<QuoteResult> {
  const parsedStore = z.uuid().safeParse(storeId);
  const parsedItems = orderItemsSchema.safeParse(items);
  if (!parsedStore.success || !parsedItems.success) return { ok: false, message: FAILED };

  const supabase = await createPublicClient();
  const { data, error } = await supabase.rpc("quote_order", { p_store_id: storeId, p_items: parsedItems.data });
  if (error) {
    console.error(`quote_order: ${error.message}`);
    return { ok: false, message: FAILED };
  }
  return { ok: true, quote: data as Quote };
}

export type PlaceOrderResult =
  | { ok: true; code: string; token: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: FieldErrors;
      soldOut?: string[];
      unavailable?: string[];
    };

const FIELD_BY_DETAIL: Record<string, string> = {
  name: "name",
  whatsapp: "whatsapp",
  fulfillment: "fulfillment",
  tax_id: "tax_id",
};

function productIds(details: string | undefined): string[] {
  try {
    const value = JSON.parse(details ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function placeOrder(
  storeId: string,
  items: unknown,
  form: Record<string, string | undefined>,
): Promise<PlaceOrderResult> {
  const customer = checkoutSchema.safeParse(form);
  if (!customer.success) {
    return { ok: false, message: "Confira os campos destacados.", fieldErrors: toFieldErrors(customer.error) };
  }
  const parsedItems = orderItemsSchema.safeParse(items);
  if (!z.uuid().safeParse(storeId).success || !parsedItems.success) {
    return { ok: false, message: "Seu carrinho tem itens inválidos. Revise e tente de novo." };
  }

  const supabase = await createPublicClient();
  const { data, error } = await supabase.rpc("create_order", {
    p_store_id: storeId,
    p_customer: customer.data,
    p_items: parsedItems.data,
  });

  if (!error) {
    const result = data as { code: string; token: string };
    return { ok: true, code: result.code, token: result.token };
  }

  switch (error.code) {
    case "CK010":
      return { ok: false, message: "Alguns itens acabaram. Ajustamos seu carrinho.", soldOut: productIds(error.details) };
    case "CK015":
      return { ok: false, message: "Alguns itens estão indisponíveis. Revise o carrinho.", unavailable: productIds(error.details) };
    case "CK012":
      return { ok: false, message: "Você já tem pedidos aguardando. Fale com a loja pelo WhatsApp." };
    case "CK013":
      return {
        ok: false,
        message: "Escolha outro horário.",
        fieldErrors: { scheduled_for: ["Horário fora da antecedência ou do expediente da loja"] },
      };
    case "CK014":
      return { ok: false, message: "Esta loja não está recebendo pedidos agora. Escolha outra." };
    case "CK011": {
      const field = FIELD_BY_DETAIL[error.details ?? ""];
      return field
        ? { ok: false, message: "Confira os campos destacados.", fieldErrors: { [field]: ["Valor inválido"] } }
        : { ok: false, message: "Seu carrinho tem itens inválidos. Revise e tente de novo." };
    }
    default:
      console.error(`create_order: ${error.code} ${error.message}`);
      return { ok: false, message: "Não foi possível enviar agora. Seu carrinho continua salvo." };
  }
}
