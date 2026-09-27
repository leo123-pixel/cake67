import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

const PAGES = [
  { path: "", priority: 1 },
  { path: "/cardapio", priority: 0.9 },
  { path: "/encomendas", priority: 0.8 },
  { path: "/privacidade", priority: 0.2 },
];

// Public RLS already hides inactive products and pending prices.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const supabase = await createPublicClient();
  const { data: products, error } = await supabase.from("products").select("slug, updated_at").order("sort");
  if (error) throw new Error(`Could not load products for sitemap: ${error.message}`);

  return [
    ...PAGES.map((page) => ({ url: `${base}${page.path}`, priority: page.priority })),
    ...products.map((product) => ({
      url: `${base}/produto/${product.slug}`,
      lastModified: product.updated_at,
      priority: 0.6,
    })),
  ];
}
