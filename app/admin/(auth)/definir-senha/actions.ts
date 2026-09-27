"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { invalid, type ActionState } from "@/lib/validators/common";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Use pelo menos 8 caracteres"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "As senhas não conferem",
  });

export async function setPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error("updateUser failed:", error.message);
    return { ok: false, message: "Não foi possível salvar a senha. Peça um novo link." };
  }

  redirect("/admin");
}
