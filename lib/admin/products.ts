import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

function coverPath(images: { path: string; sort: number }[]) {
  return [...images].sort((a, b) => a.sort - b.sort)[0]?.path ?? null;
}

// Escape LIKE wildcards typed by the user.
function likePattern(text: string) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listAdminProducts(supabase: Client, filters: { categoryId?: string; search?: string }) {
  let query = supabase
    .from("products")
    .select("id, name, type, price_cents, price_pending, active, category:categories(name), product_images(path, sort)")
    .order("name");
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.search) query = query.ilike("name", likePattern(filters.search));

  const { data, error } = await query;
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return data.map(({ product_images, category, ...product }) => ({
    ...product,
    categoryName: category?.name ?? "",
    coverPath: coverPath(product_images),
  }));
}

export async function getAdminProduct(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(id, path, alt, sort), product_addons(addon_id)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load product: ${error.message}`);
  if (!data) return null;

  const { product_images, product_addons, ...product } = data;
  return {
    product,
    images: [...product_images].sort((a, b) => a.sort - b.sort),
    addonIds: product_addons.map((link) => link.addon_id),
  };
}

export type AdminProductDetail = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;

export async function getProductFormOptions(supabase: Client) {
  const [categories, stores, addons] = await Promise.all([
    supabase.from("categories").select("id, name, kind").order("sort"),
    supabase.from("stores").select("id, name").order("sort"),
    supabase.from("addons").select("id, name, active").order("sort"),
  ]);
  const failed = categories.error ?? stores.error ?? addons.error;
  if (failed) throw new Error(`Could not load form options: ${failed.message}`);
  return { categories: categories.data!, stores: stores.data!, addons: addons.data! };
}

export type ProductFormOptions = Awaited<ReturnType<typeof getProductFormOptions>>;
