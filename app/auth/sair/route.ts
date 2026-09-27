import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason = request.nextUrl.searchParams.get("erro");
  redirect(reason === "inativo" ? "/admin/login?erro=inativo" : "/admin/login");
}

// POST from the "Sair" button (Server Actions/forms check the Origin).
export const POST = signOut;

// GET only exists for the panel to end the session of a deactivated account.
// An active member is never signed out by a plain link from another site.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (session?.staff?.active) redirect("/admin");
  return signOut(request);
}
