"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFailure } from "@/lib/admin/common";
import { getStaffContext } from "@/lib/auth";
import type { ActionState } from "@/lib/validators/common";
import { MAX_STOCK, parseCountForm, stockDelta } from "@/lib/validators/stock";

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
