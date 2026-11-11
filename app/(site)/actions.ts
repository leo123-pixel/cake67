"use server";

import { z } from "zod";
import { deliveryAddressSchema } from "@/lib/delivery/address";
import { getDeliveryQuote } from "@/lib/delivery/quote";
import { formatBRL } from "@/lib/money";
import { createPublicClient } from "@/lib/supabase/public";
import type { FieldErrors } from "@/lib/validators/common";
import { toFieldErrors } from "@/lib/validators/common";
import { checkoutSchema, orderItemsSchema } from "@/lib/validators/order";

export type QuotedLine = {
  index: number;
  product_id: string | null;
  name: string;
  type: "vitrine" | "vitrine_kg" | "bolo_kg" | "cento" | "kit" | null;
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

// What the checkout shows for delivery (spec 11). The quote id stays on the server.
export type DeliveryFee = { status: "ok"; feeCents: number } | { status: "a_combinar" };

// Delivery fee calculated on the server by Juma. Any failure is "a combinar" (D4).
export async function quoteDelivery(storeId: string, address: unknown): Promise<DeliveryFee> {
  const parsedStore = z.uuid().safeParse(storeId);
  const parsed = deliveryAddressSchema.safeParse(address);
  if (!parsedStore.success || !parsed.success) return { status: "a_combinar" };
  const quote = await getDeliveryQuote(storeId, {
    street: parsed.data.delivery_street,
    number: parsed.data.delivery_number,
    district: parsed.data.delivery_district,
  });
  return quote.ok ? { status: "ok", feeCents: quote.feeCents } : { status: "a_combinar" };
}

export type PlaceOrderResult =
  | { ok: true; code: string; token: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: FieldErrors;
      soldOut?: string[];
      unavailable?: string[];
      // The fee changed since the checkout showed it: show the new one.
      deliveryFee?: DeliveryFee;
    };

function sameFee(seen: string | undefined, fee: DeliveryFee): boolean {
  return fee.status === "ok" ? seen === String(fee.feeCents) : seen === "a_combinar";
}

function feeChanged(fee: DeliveryFee): PlaceOrderResult {
  return {
    ok: false,
    message:
      fee.status === "ok"
        ? `A taxa de entrega mudou para ${formatBRL(fee.feeCents)}. Confira o total e envie de novo.`
        : "Não conseguimos calcular a entrega agora. A taxa será combinada no WhatsApp. Confira e envie de novo.",
    deliveryFee: fee,
  };
}

const FIELD_BY_DETAIL: Record<string, string> = {
  name: "name",
  whatsapp: "whatsapp",
  fulfillment: "fulfillment",
  tax_id: "tax_id",
  delivery_street: "delivery_street",
  delivery_number: "delivery_number",
  delivery_district: "delivery_district",
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

  // Stage 11: the fee comes from a quote stored by the server; the browser only
  // says which value it showed, so a change is caught before the order exists.
  const order = customer.data;
  let quoteId: string | null = null;
  if (order.fulfillment === "entrega" && order.delivery_street && order.delivery_number && order.delivery_district) {
    const quote = await getDeliveryQuote(storeId, {
      street: order.delivery_street,
      number: order.delivery_number,
      district: order.delivery_district,
    });
    const fee: DeliveryFee = quote.ok ? { status: "ok", feeCents: quote.feeCents } : { status: "a_combinar" };
    if (!sameFee(form.delivery_fee_seen, fee)) return feeChanged(fee);
    quoteId = quote.ok ? quote.quoteId : null;
  }

  const supabase = await createPublicClient();
  const { data, error } = await supabase.rpc("create_order", {
    p_store_id: storeId,
    p_customer: { ...order, delivery_quote_id: quoteId },
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
    case "CK016":
      // The quote expired between the check above and the insert (rare).
      return feeChanged(await quoteDelivery(storeId, order));
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
