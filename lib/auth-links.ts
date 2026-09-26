import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type AuthLinkType = "invite" | "recovery";

// One-time link to /auth/confirm, built from the hashed token so it works on
// any deployment without Supabase redirect URLs or e-mail (AD-007).
// "invite" also creates the auth user when it does not exist yet.
export async function createAuthLink(
  admin: SupabaseClient<Database>,
  email: string,
  type: AuthLinkType,
  siteUrl: string,
): Promise<{ link: string; userId: string }> {
  const { data, error } = await admin.auth.admin.generateLink({ type, email });
  if (error) throw new Error(`generateLink(${type}) failed: ${error.message}`);

  const url = new URL("/auth/confirm", siteUrl);
  url.searchParams.set("token_hash", data.properties.hashed_token);
  url.searchParams.set("type", type);
  url.searchParams.set("next", "/admin/definir-senha");
  return { link: url.toString(), userId: data.user.id };
}
