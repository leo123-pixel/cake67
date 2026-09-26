"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/validators/common";

const credentials = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Echo the e-mail (never the password) so it survives the form reset.
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Informe e-mail e senha.", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Same message for unknown user and wrong password.
  if (error) return { ok: false, message: "E-mail ou senha incorretos.", values };

  redirect("/admin");
}
