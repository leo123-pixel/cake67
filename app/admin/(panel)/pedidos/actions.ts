"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFailure } from "@/lib/admin/common";
import { getStaffContext } from "@/lib/auth";
import { formatBRL } from "@/lib/money";
import { CANCEL_REASONS, OTHER_REASON } from "@/lib/order-status";
import { refundNotice } from "@/lib/payments/labels";
import { refundOrder } from "@/lib/payments/refund";

export type OrderActionResult = { ok: boolean; message?: string; notice?: { text: string; tone: "info" | "error" } | null };

const SESSION_EXPIRED = { ok: false, message: "Sua sessão expirou. Entre de novo." } as const;
const status = z.enum(["novo", "confirmado", "em_producao", "pronto", "entregue", "cancelado", "expirado"]);

function failure(context: string, error: { message: string; code?: string }): OrderActionResult {
  switch (error.code) {
    case "CK020":
      return { ok: false, message: "Este pedido mudou. Atualize a página." };
    case "CK021":
      return { ok: false, message: "Essa mudança de status não é permitida." };
    case "42501":
      return { ok: false, message: "Pedido de outra loja." };
    default:
      return dbFailure(context, error);
  }
}

function refresh(orderId: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/pedidos/${orderId}`);
}

export async function advanceOrder(orderId: string, from: string, to: string): Promise<OrderActionResult> {
  const context = await getStaffContext();
  if (!context) return SESSION_EXPIRED;
  const input = z.object({ orderId: z.uuid(), from: status, to: status }).safeParse({ orderId, from, to });
  if (!input.success) return { ok: false, message: "Ação inválida." };

  const { error } = await context.supabase.rpc("advance_order", {
    p_order_id: input.data.orderId,
    p_from: input.data.from,
    p_to: input.data.to,
  });
  if (error) return failure("advanceOrder", error);

  refresh(orderId);
  return { ok: true };
}

const cancelInput = z
  .object({
    orderId: z.uuid(),
    from: status,
    reason: z.enum(CANCEL_REASONS, { error: "Escolha o motivo" }),
    note: z.string().trim().max(180).default(""),
  })
  .refine((c) => c.reason !== OTHER_REASON || c.note.length > 0, {
    path: ["note"],
    message: "Descreva o motivo",
  });

export async function cancelOrder(orderId: string, from: string, reason: string, note: string): Promise<OrderActionResult> {
  const context = await getStaffContext();
  if (!context) return SESSION_EXPIRED;
  const input = cancelInput.safeParse({ orderId, from, reason, note });
  if (!input.success) return { ok: false, message: input.error.issues[0].message };

  const text = input.data.reason === OTHER_REASON ? input.data.note : input.data.reason;
  const { error } = await context.supabase.rpc("cancel_order", {
    p_order_id: input.data.orderId,
    p_from: input.data.from,
    p_reason: text,
  });
  if (error) return failure("cancelOrder", error);

  // Stage 11: a paid order is refunded in its store's account (spec D11).
  const notice = await refundAfterCancel(orderId);
  refresh(orderId);
  return { ok: true, notice };
}

async function refundAfterCancel(orderId: string, retry = false) {
  try {
    return refundNotice(await refundOrder(orderId, { retry }), formatBRL);
  } catch (error) {
    console.error(`refund of order ${orderId}: ${error instanceof Error ? error.message : error}`);
    return { text: "A devolução não foi feita. Use “Tentar devolver de novo”.", tone: "error" as const };
  }
}

// "Tentar devolver de novo" (spec P1 Painel 4): same staff who may see the order.
export async function retryRefund(orderId: string): Promise<OrderActionResult> {
  const context = await getStaffContext();
  if (!context) return SESSION_EXPIRED;
  if (!z.uuid().safeParse(orderId).success) return { ok: false, message: "Ação inválida." };

  // RLS: an attendant only reads orders of their store.
  const { data: order, error } = await context.supabase.from("orders").select("id, payment_status").eq("id", orderId).maybeSingle();
  if (error) return failure("retryRefund", error);
  if (!order) return { ok: false, message: "Pedido de outra loja." };
  if (order.payment_status !== "falha_devolucao") return { ok: false, message: "Este pedido não tem devolução pendente. Atualize a página." };

  const notice = await refundAfterCancel(orderId, true);
  refresh(orderId);
  return { ok: true, notice };
}

export async function reactivateOrder(orderId: string): Promise<OrderActionResult> {
  const context = await getStaffContext();
  if (!context) return SESSION_EXPIRED;
  if (!z.uuid().safeParse(orderId).success) return { ok: false, message: "Ação inválida." };

  const { supabase } = context;
  const { error } = await supabase.rpc("reactivate_order", { p_order_id: orderId });
  if (error?.code === "CK010") {
    const ids = (() => {
      try {
        return JSON.parse(error.details ?? "[]") as string[];
      } catch {
        return [];
      }
    })();
    const { data } = await supabase
      .from("order_items")
      .select("name_snapshot")
      .eq("order_id", orderId)
      .in("product_id", ids);
    const names = [...new Set((data ?? []).map((row) => row.name_snapshot))].join(", ");
    return { ok: false, message: `Não dá para reativar: acabou ${names || "um dos itens"}.` };
  }
  if (error) return failure("reactivateOrder", error);

  refresh(orderId);
  return { ok: true };
}
