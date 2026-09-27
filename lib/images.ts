import { publicEnv } from "@/lib/env";

export const PRODUCT_BUCKET = "produtos";
const PLACEHOLDER_IMAGE = "/placeholder-product.svg";

export function productImageUrl(path: string | null): string {
  if (!path) return PLACEHOLDER_IMAGE;
  const { supabaseUrl } = publicEnv();
  return `${supabaseUrl}/storage/v1/object/public/${PRODUCT_BUCKET}/${path}`;
}
