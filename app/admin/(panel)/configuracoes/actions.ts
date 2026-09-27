"use server";

import { revalidatePath } from "next/cache";
import { dbFailure } from "@/lib/admin/common";
import { getAdminContext, NOT_ALLOWED } from "@/lib/auth";
import { invalid, readForm, type ActionState } from "@/lib/validators/common";
import { settingsSchema } from "@/lib/validators/settings";

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const values = readForm(formData);
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const { data, error } = await context.supabase.from("settings").update(parsed.data).eq("id", 1).select("id");
  if (error) return { ...dbFailure("saveSettings", error), values };
  // RLS filters instead of failing: no row means no permission.
  if (!data.length) return { ...NOT_ALLOWED, values };

  revalidatePath("/admin", "layout");
  return { ok: true, message: "Configurações salvas. Valem a partir do próximo pedido." };
}
