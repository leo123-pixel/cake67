import "server-only";
import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

// Anonymous client for the public site: never carries a staff session, so a
// signed-in admin browsing the site sees exactly what customers see.
// connection() keeps the calling route dynamic (fresh catalog on every visit).
export async function createPublicClient() {
  await connection();
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
