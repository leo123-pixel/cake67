// Prints a one-time "set password" link for an existing team member.
// Usage: npm run admin:link -- <email>
// SITE_URL overrides NEXT_PUBLIC_SITE_URL (e.g. to point at a preview).
// New members are invited from the panel (Usuários), not here.
import { createClient } from "@supabase/supabase-js";
import { createAuthLink } from "@/lib/auth-links";
import type { Database } from "@/lib/database.types";
import { parsePublicEnv, parseServerEnv } from "@/lib/env";

async function main() {
  const [email] = process.argv.slice(2);
  if (!email) throw new Error("Usage: npm run admin:link -- <email>");

  const { supabaseUrl, siteUrl } = parsePublicEnv(process.env);
  const { serviceRoleKey } = parseServerEnv(process.env);
  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // "recovery" never creates users: it fails for unknown e-mails.
  const { link, userId } = await createAuthLink(admin, email, "recovery", process.env.SITE_URL ?? siteUrl);

  const { data: staff, error } = await admin.from("staff").select("active").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Could not read staff: ${error.message}`);
  if (!staff?.active) throw new Error(`${email} is not an active team member; link not shown.`);

  console.log(link);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
