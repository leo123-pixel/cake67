import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv, serverEnv } from "@/lib/env";

// Service-role client: bypasses RLS. Server-only (user invites, maintenance).
export function createAdminClient() {
  const { supabaseUrl } = publicEnv();
  const { serviceRoleKey } = serverEnv();

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
