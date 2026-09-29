"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFailure } from "@/lib/admin/common";
import { getStaffContext } from "@/lib/auth";
import type { ActionState } from "@/lib/validators/common";
import { MAX_STOCK, parseCountForm, stockDelta } from "@/lib/validators/stock";
import { MAX_PIECE_GRAMS, MIN_PIECE_GRAMS } from "@/lib/weight";

export type StockResult = { ok: boolean; quantity?: number; message?: string };

const SESSION_EXPIRED = { ok: false, message: "Sua sessão expirou. Entre de novo." } as const;
const OTHER_STORE = "Você não pode mexer no estoque desta loja.";

const ids = z.object({ productId: z.uuid(), storeId: z.uuid() });

function stockFailure(context: string, error: { message: string; code?: string }): StockResult {
  if (error.code === "42501") return { ok: false, message: OTHER_STORE };
  return dbFailure(context, error);
}

export async function adjustStock(productId: string, storeId: string, delta: number): Promise<StockResult> {
  const context = await getStaffContext();
  if (!context) return SESSION_EXPIRED;
  if (!ids.safeParse({ productId, storeId }).success || !stockDelta.safeParse(delta).success) {
    return { ok: false, message: "Ajuste inválido." };
  }

  const { data, error } = await context.supabase.rpc("adjust_stock", {
    p_product_id: productId,
    p_store_id: storeId,
    p_delta: delta,
  });
  if (error) return stockFailure("adjustStock", error);

  revalidatePath("/admin/estoque", "layout");
  return { ok: true, quantity: data };
}

export async function setStock(productId: string, storeId: string, quantity: number): Promise<StockResult> {
  const context = await getStaffContext();
  if (!context) return SESSION_EXPIRED;
  const valid = z.number().int().min(0).max(MAX_STOCK).safeParse(quantity);
  if (!ids.safeParse({ productId, storeId }).success || !valid.success) {
    return { ok: false, message: `Use um número inteiro entre 0 e ${MAX_STOCK}.` };
  }

  const { data, error } = await context.supabase.rpc("set_stock", {
    p_product_id: productId,
    p_store_id: storeId,
    p_quantity: quantity,
  });
  if (error) return stockFailure("setStock", error);

  revalidatePath("/admin/estoque", "layout");
  return { ok: true, quantity: data };
}

export async function countStock(storeId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await getStaffContext();
  if (!context) return SESSION_EXPIRED;
  if (!z.uuid().safeParse(storeId).success) return { ok: false, message: "Loja inválida." };

  const { items, errors, values } = parseCountForm(formData);
  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Nada foi salvo. Confira os campos destacados.", fieldErrors: errors, values };
  }

  const { data, error } = await context.supabase.rpc("count_stock", { p_store_id: storeId, p_items: items });
  if (error) {
    const failure = stockFailure("countStock", error);
    return { ok: false, message: `Nada foi salvo. ${failure.message}`, values };
  }

  revalidatePath("/admin/estoque", "layout");
  return {
    ok: true,
    message: data === 0 ? "Nenhuma quantidade mudou." : `${data} ${data === 1 ? "item atualizado" : "itens atualizados"}.`,
  };
}

// --- weighed cakes (stage 10) ---------------------------------------------------

export type PieceResult = { ok: boolean; message?: string };

const pieceId = z.uuid();
const pieceGrams = z.number().int().min(MIN_PIECE_GRAMS).max(MAX_PIECE_GRAMS);
const BAD_WEIGHT = "Peso entre 0,300 e 10,000 kg, ex. 1,340.";

type StaffClient = NonNullable<Awaited<ReturnType<typeof getStaffContext>>>["supabase"];
type RpcCall = (supabase: StaffClient) => PromiseLike<{ error: { message: string; code?: string } | null }>;

async function pieceCall(name: string, call: RpcCall): Promise<PieceResult> {
  const context = await getStaffContext();
  if (!context) return SESSION_EXPIRED;
  const { error } = await call(context.supabase);
  if (error) return stockFailure(name, error);
  revalidatePath("/admin/estoque", "layout");
  return { ok: true };
}

export async function addPiece(productId: string, storeId: string, weightG: number): Promise<PieceResult> {
  if (!ids.safeParse({ productId, storeId }).success) return { ok: false, message: "Bolo inválido." };
  if (!pieceGrams.safeParse(weightG).success) return { ok: false, message: BAD_WEIGHT };
  return pieceCall("addPiece", (supabase) =>
    supabase.rpc("add_piece", { p_product_id: productId, p_store_id: storeId, p_weight_g: weightG }),
  );
}

export async function sellPiece(id: string): Promise<PieceResult> {
  if (!pieceId.safeParse(id).success) return { ok: false, message: "Bolo inválido." };
  return pieceCall("sellPiece", (supabase) => supabase.rpc("sell_piece", { p_piece_id: id }));
}

export async function discardPiece(id: string): Promise<PieceResult> {
  if (!pieceId.safeParse(id).success) return { ok: false, message: "Bolo inválido." };
  return pieceCall("discardPiece", (supabase) => supabase.rpc("discard_piece", { p_piece_id: id }));
}

export async function correctPieceWeight(id: string, weightG: number): Promise<PieceResult> {
  if (!pieceId.safeParse(id).success) return { ok: false, message: "Bolo inválido." };
  if (!pieceGrams.safeParse(weightG).success) return { ok: false, message: BAD_WEIGHT };
  return pieceCall("correctPieceWeight", (supabase) =>
    supabase.rpc("set_piece_weight", { p_piece_id: id, p_weight_g: weightG }),
  );
}
