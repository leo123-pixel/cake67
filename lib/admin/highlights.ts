import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type HighlightStatus = "vigente" | "agendado" | "encerrado" | "inativo";

export function highlightStatus(
  h: { active: boolean; starts_at: string | null; ends_at: string | null },
  now = new Date(),
): HighlightStatus {
  if (!h.active) return "inativo";
  if (h.starts_at && new Date(h.starts_at) > now) return "agendado";
  if (h.ends_at && new Date(h.ends_at) <= now) return "encerrado";
  return "vigente";
}

export async function listAdminHighlights(supabase: Client) {
  const { data, error } = await supabase
    .from("highlights")
    .select("id, slot, title, active, starts_at, ends_at, sort, product:products(name)")
    .order("sort");
  if (error) throw new Error(`Could not load highlights: ${error.message}`);
  return data.map(({ product, ...h }) => ({ ...h, productName: product?.name ?? null, status: highlightStatus(h) }));
}

export type AdminHighlightRow = Awaited<ReturnType<typeof listAdminHighlights>>[number];

export async function getAdminHighlight(supabase: Client, id: string) {
  const { data, error } = await supabase.from("highlights").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load highlight: ${error.message}`);
  return data;
}

export async function listProductChoices(supabase: Client) {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, active, price_pending")
    .order("name");
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return data;
}
