import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason = request.nextUrl.searchParams.get("erro");
  redirect(reason === "inativo" ? "/admin/login?erro=inativo" : "/admin/login");
}

// POST from the "Sair" button; GET when the panel finds an inactive account.
export const POST = signOut;
export const GET = signOut;
