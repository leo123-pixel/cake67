import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// One-time links from the admin panel (AD-007): /auth/confirm?token_hash&type&next
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const next = params.get("next");
  const destination = next?.startsWith("/admin/") && !next.startsWith("/admin//") ? next : "/admin";

  if (tokenHash && (type === "invite" || type === "recovery")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(destination);
    console.warn("verifyOtp failed:", error.message);
  }

  redirect("/admin/login?erro=link");
}
