"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFailure } from "@/lib/admin/common";
import { getStaffContext } from "@/lib/auth";
import { CANCEL_REASONS, OTHER_REASON } from "@/lib/order-status";

export type OrderActionResult = { ok: boolean; message?: string };

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

  refresh(orderId);
  return { ok: true };
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
