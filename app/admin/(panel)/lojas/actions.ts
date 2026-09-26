"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbFailure, isUniqueViolation, nextSort, uniqueSlug } from "@/lib/admin/common";
import { getAdminContext, NOT_ALLOWED } from "@/lib/auth";
import { invalid, readForm, type ActionState } from "@/lib/validators/common";
import { readHours, storeSchema } from "@/lib/validators/store";

export async function saveStore(storeId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const values = readForm(formData);
  const parsed = storeSchema.safeParse({ ...values, hours: readHours(values) });
  if (!parsed.success) return invalid(parsed.error, values);

  const { supabase } = context;
  if (storeId) {
    const { error } = await supabase.from("stores").update(parsed.data).eq("id", storeId);
    if (error) return { ...dbFailure("updateStore", error), values };
    revalidatePath("/admin/lojas", "layout");
    return { ok: true, message: "Loja salva." };
  }

  const insert = async () =>
    supabase.from("stores").insert({
      ...parsed.data,
      slug: await uniqueSlug(supabase, "stores", parsed.data.name),
      sort: await nextSort(supabase, "stores"),
    });
  let { error } = await insert();
  if (isUniqueViolation(error)) ({ error } = await insert());
  if (error) return { ...dbFailure("createStore", error), values };

  revalidatePath("/admin/lojas", "layout");
  redirect("/admin/lojas");
}
