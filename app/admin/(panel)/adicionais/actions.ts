"use server";

import { revalidatePath } from "next/cache";
import { dbFailure, nextSort } from "@/lib/admin/common";
import { getAdminContext, NOT_ALLOWED } from "@/lib/auth";
import { addonSchema } from "@/lib/validators/catalog";
import { invalid, readForm, type ActionState } from "@/lib/validators/common";

const DUPLICATE_NAME = { ok: false, message: "Já existe um adicional com esse nome." } as const;

export async function createAddon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const parsed = addonSchema.safeParse({ ...readForm(formData), active: "on" });
  if (!parsed.success) return invalid(parsed.error);

  const { supabase } = context;
  const { error } = await supabase.from("addons").insert({ ...parsed.data, sort: await nextSort(supabase, "addons") });
  if (error?.code === "23505") return DUPLICATE_NAME;
  if (error) return dbFailure("createAddon", error);

  revalidatePath("/admin/adicionais");
  return { ok: true, message: `Adicional "${parsed.data.name}" criado.` };
}

export async function updateAddon(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const parsed = addonSchema.safeParse(readForm(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await context.supabase.from("addons").update(parsed.data).eq("id", id);
  if (error?.code === "23505") return DUPLICATE_NAME;
  if (error) return dbFailure("updateAddon", error);

  revalidatePath("/admin/adicionais");
  return { ok: true, message: "Salvo." };
}
