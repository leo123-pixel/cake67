import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

// Anon-key client for Server Components, Server Actions and Route Handlers.
// Every query runs under RLS as the visitor (or the signed-in staff member).
export async function createClient() {
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot set cookies; the session refresh happens in
          // middleware (stage 02), so ignoring here is the documented pattern.
        }
      },
    },
  });
}
