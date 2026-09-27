"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbFailure, nextSort } from "@/lib/admin/common";
import { getAdminContext, NOT_ALLOWED } from "@/lib/auth";
import { invalid, readForm, type ActionState } from "@/lib/validators/common";
import { highlightSchema } from "@/lib/validators/highlight";

export async function saveHighlight(
  highlightId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const values = readForm(formData);
  const parsed = highlightSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const { supabase } = context;
  const { error } = highlightId
    ? await supabase.from("highlights").update(parsed.data).eq("id", highlightId)
    : await supabase.from("highlights").insert({ ...parsed.data, sort: await nextSort(supabase, "highlights") });
  if (error) return { ...dbFailure("saveHighlight", error), values };

  revalidatePath("/admin/destaques", "layout");
  if (!highlightId) redirect("/admin/destaques");
  return { ok: true, message: "Destaque salvo." };
}

export async function deleteHighlight(highlightId: string): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const { error } = await context.supabase.from("highlights").delete().eq("id", highlightId);
  if (error) return dbFailure("deleteHighlight", error);

  revalidatePath("/admin/destaques", "layout");
  redirect("/admin/destaques");
}
