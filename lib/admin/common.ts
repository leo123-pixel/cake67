import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { nextFreeSlug, slugify } from "@/lib/slug";
import type { ActionState } from "@/lib/validators/common";

type Client = SupabaseClient<Database>;
type SluggedTable = "products" | "categories" | "stores";
type SortedTable = "categories" | "addons" | "stores" | "highlights" | "products";

const LAST_ADMIN = "CK001";
const UNIQUE_VIOLATION = "23505";

export function dbFailure(context: string, error: { message: string; code?: string }): ActionState {
  console.error(`${context}: ${error.message}`);
  if (error.code === LAST_ADMIN) {
    return { ok: false, message: "É preciso manter pelo menos um administrador ativo." };
  }
  return { ok: false, message: "Não foi possível salvar. Tente de novo." };
}

export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === UNIQUE_VIOLATION;
}

// Slug from the name, suffixed (-2, -3...) when taken. Slugs never change after
// creation, so links stay stable.
export async function uniqueSlug(supabase: Client, table: SluggedTable, name: string): Promise<string> {
  const base = slugify(name) || "item";
  const { data, error } = await supabase.from(table).select("slug").like("slug", `${base}%`);
  if (error) throw new Error(`Could not check slugs: ${error.message}`);
  return nextFreeSlug(base, data.map((row) => row.slug));
}

export async function nextSort(supabase: Client, table: SortedTable): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select("sort")
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not read sort: ${error.message}`);
  return (data?.sort ?? 0) + 1;
}
