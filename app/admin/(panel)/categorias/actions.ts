"use server";

import { revalidatePath } from "next/cache";
import { dbFailure, isUniqueViolation, nextSort, uniqueSlug } from "@/lib/admin/common";
import { getAdminContext, NOT_ALLOWED } from "@/lib/auth";
import { categorySchema } from "@/lib/validators/catalog";
import { invalid, readForm, type ActionState } from "@/lib/validators/common";

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const parsed = categorySchema.safeParse({ ...readForm(formData), active: "on" });
  if (!parsed.success) return invalid(parsed.error);

  const { supabase } = context;
  const row = {
    ...parsed.data,
    slug: await uniqueSlug(supabase, "categories", parsed.data.name),
    sort: await nextSort(supabase, "categories"),
  };

  let { error } = await supabase.from("categories").insert(row);
  if (isUniqueViolation(error)) {
    // Another admin took the slug between the check and the insert.
    const slug = await uniqueSlug(supabase, "categories", row.name);
    ({ error } = await supabase.from("categories").insert({ ...row, slug }));
  }
  if (error) return dbFailure("createCategory", error);

  revalidatePath("/admin/categorias");
  return { ok: true, message: `Categoria "${row.name}" criada.` };
}

export async function updateCategory(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const parsed = categorySchema.safeParse(readForm(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await context.supabase.from("categories").update(parsed.data).eq("id", id);
  if (error) return dbFailure("updateCategory", error);

  revalidatePath("/admin/categorias");
  return { ok: true, message: "Salvo." };
}
