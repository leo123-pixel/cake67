"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext, NOT_ALLOWED } from "@/lib/auth";
import type { ActionState } from "@/lib/validators/common";

const SORTABLE = {
  categories: "/admin/categorias",
  addons: "/admin/adicionais",
  stores: "/admin/lojas",
  highlights: "/admin/destaques",
  product_images: "/admin/produtos",
} as const;

const reorderInput = z.object({
  table: z.enum(Object.keys(SORTABLE) as [keyof typeof SORTABLE, ...(keyof typeof SORTABLE)[]]),
  ids: z.array(z.uuid()).min(1),
});

export async function reorderItems(table: keyof typeof SORTABLE, ids: string[]): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const input = reorderInput.safeParse({ table, ids });
  if (!input.success) return { ok: false, message: "Ordem inválida." };

  const { error } = await context.supabase.rpc("reorder", { p_table: input.data.table, p_ids: input.data.ids });
  if (error) {
    console.error(`reorder ${table}: ${error.message}`);
    return { ok: false, message: "Não foi possível salvar a ordem." };
  }

  revalidatePath(SORTABLE[input.data.table], "layout");
  return { ok: true };
}
