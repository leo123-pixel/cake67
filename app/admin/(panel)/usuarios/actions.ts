"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { dbFailure } from "@/lib/admin/common";
import { findAuthUserByEmail } from "@/lib/admin/staff";
import { getAdminContext, NOT_ALLOWED } from "@/lib/auth";
import { createAuthLink } from "@/lib/auth-links";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalid, readForm, type ActionState } from "@/lib/validators/common";
import { staffInviteSchema, staffUpdateSchema } from "@/lib/validators/staff";

// Links point at the deployment the admin is using (preview or production).
// Next.js already rejects Server Actions whose Origin does not match the host.
async function siteOrigin() {
  return (await headers()).get("origin") ?? publicEnv().siteUrl;
}

export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const values = readForm(formData);
  const parsed = staffInviteSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  const { email, ...member } = parsed.data;

  const admin = createAdminClient();
  const existing = await findAuthUserByEmail(admin, email);
  if (existing) {
    const { data: staff } = await context.supabase
      .from("staff")
      .select("active")
      .eq("user_id", existing.id)
      .maybeSingle();
    if (staff?.active) return { ok: false, message: "Este e-mail já faz parte da equipe.", values };
    if (staff) return { ok: false, message: "Este e-mail está desativado. Use “Reativar” na lista.", values };
  }

  let userId: string;
  let link: string;
  try {
    ({ userId, link } = await createAuthLink(admin, email, existing ? "recovery" : "invite", await siteOrigin()));
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Não foi possível gerar o convite. Tente de novo.", values };
  }

  const { error } = await context.supabase.from("staff").insert({ user_id: userId, ...member });
  if (error) {
    // Do not leave a login without a team row.
    if (!existing) await admin.auth.admin.deleteUser(userId);
    return { ...dbFailure("inviteMember", error), values };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true, message: `Convite criado para ${email}.`, link };
}

export async function generatePasswordLink(userId: string): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;
  if (!z.uuid().safeParse(userId).success) return { ok: false, message: "Usuário inválido." };

  const { data: staff } = await context.supabase.from("staff").select("active").eq("user_id", userId).maybeSingle();
  if (!staff?.active) return { ok: false, message: "Só é possível gerar link para quem está ativo." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user.email) return { ok: false, message: "Usuário não encontrado." };

  try {
    const { link } = await createAuthLink(admin, data.user.email, "recovery", await siteOrigin());
    return { ok: true, link };
  } catch (failure) {
    console.error(failure);
    return { ok: false, message: "Não foi possível gerar o link. Tente de novo." };
  }
}

export async function updateMember(userId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const parsed = staffUpdateSchema.safeParse(readForm(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await context.supabase.from("staff").update(parsed.data).eq("user_id", userId);
  if (error) return dbFailure("updateMember", error);

  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Salvo." };
}

export async function setMemberActive(userId: string, active: boolean): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const { error } = await context.supabase.from("staff").update({ active }).eq("user_id", userId);
  if (error) return dbFailure("setMemberActive", error);

  revalidatePath("/admin/usuarios");
  return { ok: true };
}
