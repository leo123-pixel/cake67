import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { nextFreeSlug, slugify } from "@/lib/slug";
import type { ActionState } from "@/lib/validators/common";

type Client = SupabaseClient<Database>;
type SluggedTable = "products" | "categories" | "stores";
type SortedTable = "categories" | "addons" | "stores" | "highlights" | "products";

const UNIQUE_VIOLATION = "23505";

// Error codes raised by our SQL functions and triggers.
const DB_MESSAGES: Record<string, string> = {
  CK001: "É preciso manter pelo menos um administrador ativo.",
  CK002: "O estoque não pode ficar negativo.",
  CK003: "Quantidade acima de 9999. Confira o número.",
  CK004: "Este produto não é de vitrine.",
  "42501": "Você não tem permissão para esta ação.",
};

export function dbFailure(context: string, error: { message: string; code?: string }): ActionState {
  console.error(`${context}: ${error.message}`);
  const known = error.code ? DB_MESSAGES[error.code] : undefined;
  return { ok: false, message: known ?? "Não foi possível salvar. Tente de novo." };
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
