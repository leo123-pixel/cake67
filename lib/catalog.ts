import type { Tables } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const PRODUCT_BUCKET = "produtos";
const PLACEHOLDER_IMAGE = "/placeholder-product.svg";

export type Store = Pick<Tables<"stores">, "id" | "slug" | "name" | "address">;

export type MenuProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  imageAlt: string;
  available: boolean;
};

export type MenuCategory = {
  id: string;
  slug: string;
  name: string;
  products: MenuProduct[];
};

export function productImageUrl(path: string | null): string {
  if (!path) return PLACEHOLDER_IMAGE;
  const { supabaseUrl } = publicEnv();
  return `${supabaseUrl}/storage/v1/object/public/${PRODUCT_BUCKET}/${path}`;
}

export function isSoldInStore(storeIds: string[], storeId: string): boolean {
  return storeIds.length === 0 || storeIds.includes(storeId);
}

export async function listStores(): Promise<Store[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id, slug, name, address")
    .order("sort");

  if (error) throw new Error(`Could not load stores: ${error.message}`);
  return data;
}

async function loadAvailability(storeId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_availability")
    .select("product_id, available")
    .eq("store_id", storeId);

  if (error) throw new Error(`Could not load availability: ${error.message}`);
  return new Set(data.filter((row) => row.available).map((row) => row.product_id ?? ""));
}

async function loadVitrineCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select(
      "id, slug, name, products(id, slug, name, description, price_cents, sort, type, store_ids, product_images(path, alt, sort))",
    )
    .eq("kind", "vitrine")
    .eq("products.type", "vitrine")
    .order("sort")
    .order("sort", { referencedTable: "products" });

  if (error) throw new Error(`Could not load menu: ${error.message}`);
  return data;
}

// Active vitrine products sold in the store, grouped by category, with the
// store's availability. Categories without products are dropped.
export async function listVitrineMenu(storeId: string): Promise<MenuCategory[]> {
  const [categories, available] = await Promise.all([
    loadVitrineCategories(),
    loadAvailability(storeId),
  ]);

  return categories
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      products: category.products
        .filter((product) => isSoldInStore(product.store_ids, storeId))
        .map((product): MenuProduct => {
          const cover = [...product.product_images].sort((a, b) => a.sort - b.sort)[0];
          return {
            id: product.id,
            slug: product.slug,
            name: product.name,
            description: product.description,
            priceCents: product.price_cents,
            imageUrl: productImageUrl(cover?.path ?? null),
            imageAlt: cover?.alt || product.name,
            available: available.has(product.id),
          };
        }),
    }))
    .filter((category) => category.products.length > 0);
}
