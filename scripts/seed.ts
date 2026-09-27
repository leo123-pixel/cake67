// Seeds what seed.sql cannot: product photos in Storage and the admin user.
// Idempotent. Usage: npm run seed (reads .env.local).
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { parsePublicEnv, parseServerEnv } from "@/lib/env";

const BUCKET = "produtos";
const IMAGE_DIR = path.join(process.cwd(), "prototipo", "img");
const ADMIN_NAME = "Leonardo";

type AdminClient = SupabaseClient<Database>;

async function uploadSeedImages(supabase: AdminClient) {
  const files = (await readdir(IMAGE_DIR)).filter((file) => file.endsWith(".webp"));

  for (const file of files) {
    const body = await readFile(path.join(IMAGE_DIR, file));
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`seed/${file}`, body, { contentType: "image/webp", upsert: true });
    if (error) throw new Error(`Upload failed for ${file}: ${error.message}`);
  }

  console.log(`Uploaded ${files.length} images to ${BUCKET}/seed/`);
}

async function findUserIdByEmail(supabase: AdminClient, email: string) {
  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Could not list users: ${error.message}`);

    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return user.id;
    if (data.users.length < perPage) return null;
  }
}

async function ensureAdmin(supabase: AdminClient, email: string) {
  let userId = await findUserIdByEmail(supabase, email);

  if (!userId) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
    if (error) throw new Error(`Could not invite ${email}: ${error.message}`);
    userId = data.user.id;
    console.log(`Invited ${email}`);
  }

  const { error } = await supabase
    .from("staff")
    .upsert(
      { user_id: userId, name: ADMIN_NAME, role: "admin", store_id: null },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(`Could not save staff row: ${error.message}`);

  console.log(`Admin ready: ${email}`);
}

async function main() {
  // Validate everything before the first write.
  const { supabaseUrl } = parsePublicEnv(process.env);
  const { serviceRoleKey } = parseServerEnv(process.env);
  const adminEmail = z.email({ error: "ADMIN_EMAIL must be a valid e-mail" }).parse(
    process.env.ADMIN_EMAIL,
  );

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await uploadSeedImages(supabase);
  await ensureAdmin(supabase, adminEmail);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
