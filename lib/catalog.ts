import type { Tables } from "@/lib/database.types";
import { productImageUrl } from "@/lib/images";
import { createPublicClient } from "@/lib/supabase/public";

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
  availableQty: number;
};

export type MenuCategory = {
  id: string;
  slug: string;
  name: string;
  products: MenuProduct[];
};

export type HomeHighlight = {
  id: string;
  slot: Tables<"highlights">["slot"];
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

type HighlightRow = Pick<
  Tables<"highlights">,
  "id" | "slot" | "title" | "subtitle" | "image_path" | "cta_label" | "cta_href" | "product_id"
> & { product: { product_images: { path: string; sort: number }[] } | null };

// Drops highlights whose linked product is hidden from the public (inactive or
// pending price: RLS returns product = null). Image: own, else product cover.
export function toHomeHighlights(rows: HighlightRow[]): HomeHighlight[] {
  return rows
    .filter((row) => !row.product_id || row.product)
    .map((row) => {
      const cover = row.product
        ? [...row.product.product_images].sort((a, b) => a.sort - b.sort)[0]?.path
        : undefined;
      const path = row.image_path ?? cover ?? null;
      return {
        id: row.id,
        slot: row.slot,
        title: row.title,
        subtitle: row.subtitle,
        imageUrl: path ? productImageUrl(path) : null,
        ctaLabel: row.cta_label,
        ctaHref: row.cta_href,
      };
    });
}

// RLS already limits highlights to active ones inside their period.
export async function listHomeHighlights(): Promise<HomeHighlight[]> {
  const supabase = await createPublicClient();
  const { data, error } = await supabase
    .from("highlights")
    .select("id, slot, title, subtitle, image_path, cta_label, cta_href, product_id, product:products(product_images(path, sort))")
    .order("sort");

  if (error) throw new Error(`Could not load highlights: ${error.message}`);
  return toHomeHighlights(data);
}

export function isSoldInStore(storeIds: string[], storeId: string): boolean {
  return storeIds.length === 0 || storeIds.includes(storeId);
}

export async function listStores(): Promise<Store[]> {
  const supabase = await createPublicClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id, slug, name, address")
    .order("sort");

  if (error) throw new Error(`Could not load stores: ${error.message}`);
  return data;
}

// product_id -> quantity available (the public view caps it at 10).
async function loadAvailability(storeId: string): Promise<Map<string, number>> {
  const supabase = await createPublicClient();
  const { data, error } = await supabase
    .from("product_availability")
    .select("product_id, quantity")
    .eq("store_id", storeId);

  if (error) throw new Error(`Could not load availability: ${error.message}`);
  return new Map(data.map((row) => [row.product_id ?? "", row.quantity ?? 0]));
}

async function loadVitrineCategories() {
  const supabase = await createPublicClient();
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
            available: (available.get(product.id) ?? 0) > 0,
            availableQty: available.get(product.id) ?? 0,
          };
        }),
    }))
    .filter((category) => category.products.length > 0);
}
