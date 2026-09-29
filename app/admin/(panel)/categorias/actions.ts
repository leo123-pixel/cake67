"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFailure, isUniqueViolation, nextSort, uniqueSlug } from "@/lib/admin/common";
import { getAdminContext, NOT_ALLOWED } from "@/lib/auth";
import { categorySchema } from "@/lib/validators/catalog";
import { invalid, readForm, type ActionState } from "@/lib/validators/common";

const FOREIGN_KEY_VIOLATION = "23503";

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

const categoryId = z.uuid();

// "Ativar / desativar" from the menu: same as the "Mostrar no site" checkbox.
export async function setCategoryActive(id: string, active: boolean): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;
  if (!categoryId.safeParse(id).success) return { ok: false, message: "Categoria inválida." };

  const { error } = await context.supabase.from("categories").update({ active }).eq("id", id);
  if (error) return dbFailure("setCategoryActive", error);

  revalidatePath("/admin/categorias");
  return { ok: true };
}

// Copy with the same kind, no products, hidden until renamed and activated.
export async function duplicateCategory(id: string): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;
  if (!categoryId.safeParse(id).success) return { ok: false, message: "Categoria inválida." };

  const { supabase } = context;
  const { data: category, error: readError } = await supabase.from("categories").select("name, kind").eq("id", id).maybeSingle();
  if (readError) return dbFailure("duplicateCategory", readError);
  if (!category) return { ok: false, message: "Categoria não encontrada." };

  const name = `${category.name} (cópia)`;
  const row = {
    name,
    kind: category.kind,
    active: false,
    slug: await uniqueSlug(supabase, "categories", name),
    sort: await nextSort(supabase, "categories"),
  };
  let { error } = await supabase.from("categories").insert(row);
  if (isUniqueViolation(error)) {
    ({ error } = await supabase.from("categories").insert({ ...row, slug: await uniqueSlug(supabase, "categories", name) }));
  }
  if (error) return dbFailure("duplicateCategory", error);

  revalidatePath("/admin/categorias");
  return { ok: true, message: `Categoria "${name}" criada.` };
}

// Only empty categories: products keep their category (FK on delete restrict).
export async function deleteCategory(id: string): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;
  if (!categoryId.safeParse(id).success) return { ok: false, message: "Categoria inválida." };

  const { error } = await context.supabase.from("categories").delete().eq("id", id);
  if (error?.code === FOREIGN_KEY_VIOLATION) {
    return {
      ok: false,
      message: "Esta categoria tem produtos. Mova ou exclua os produtos antes, ou desative a categoria.",
    };
  }
  if (error) return dbFailure("deleteCategory", error);

  revalidatePath("/admin/categorias");
  return { ok: true };
}
