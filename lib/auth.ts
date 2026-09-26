import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Enums } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type Staff = {
  userId: string;
  email: string;
  name: string;
  role: Enums<"staff_role">;
  storeId: string | null;
  active: boolean;
};

// Signed-in user and their staff row (read through RLS "staff reads own row").
// null = no session; staff null = signed in but not part of the team.
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("staff")
    .select("name, role, store_id, active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Could not load staff: ${error.message}`);

  const staff: Staff | null = data && {
    userId: user.id,
    email: user.email ?? "",
    name: data.name,
    role: data.role,
    storeId: data.store_id,
    active: data.active,
  };
  return { supabase, staff };
});

// For pages: active staff or a redirect. Sign-out happens in a route handler
// because Server Components cannot clear cookies.
export async function requireStaff() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!session.staff?.active) redirect("/auth/sair?erro=inativo");
  return { supabase: session.supabase, staff: session.staff };
}

export async function requireAdmin() {
  const context = await requireStaff();
  if (context.staff.role !== "admin") redirect("/admin/sem-permissao");
  return context;
}

// For Server Actions open to any active staff (stock). Store-level
// authorization is enforced by the database functions.
export async function getStaffContext() {
  const session = await getSession();
  if (!session?.staff?.active) return null;
  return { supabase: session.supabase, staff: session.staff };
}

// For Server Actions: null instead of redirecting, so the action can answer.
export async function getAdminContext() {
  const session = await getSession();
  if (!session?.staff?.active || session.staff.role !== "admin") return null;
  return { supabase: session.supabase, staff: session.staff };
}

export const NOT_ALLOWED = { ok: false, message: "Você não tem permissão para esta ação." } as const;
