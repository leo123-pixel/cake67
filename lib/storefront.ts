// Public queries for ordering (anon, no session). Prices shown here are for
// display; the database recomputes everything when quoting and ordering.
import { productImageUrl } from "@/lib/images";
import { createPublicClient } from "@/lib/supabase/public";
import { parseStoredHours, type StoreHours } from "@/lib/validators/store";
import type { OrderSummary } from "@/lib/whatsapp";

export type CheckoutStore = {
  id: string;
  slug: string;
  name: string;
  address: string;
  whatsapp: string;
  hours: StoreHours;
};

export async function listCheckoutStores(): Promise<CheckoutStore[]> {
  const supabase = await createPublicClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id, slug, name, address, whatsapp, hours")
    .order("sort");
  if (error) throw new Error(`Could not load stores: ${error.message}`);
  return data.map((store) => ({ ...store, hours: parseStoredHours(store.hours) }));
}

export type Addon = { id: string; name: string; priceCents: number };

export type MadeToOrderProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: "bolo_kg" | "cento" | "kit";
  priceCents: number;
  imageUrl: string;
  leadTimeHours: number;
  weightsKg: number[];
  formats: string[];
  minQty: number | null;
  stepQty: number | null;
  kitContents: string | null;
  storeIds: string[];
  addons: Addon[];
};

// Cakes, cento and kits on sale (RLS hides inactive and pending-price ones).
export async function listMadeToOrder(): Promise<MadeToOrderProduct[]> {
  const supabase = await createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, name, description, type, price_cents, sort, lead_time_hours, weights_kg, formats, min_qty, step_qty, kit_contents, store_ids, product_images(path, sort), product_addons(addon:addons(id, name, price_cents, sort))",
    )
    .in("type", ["bolo_kg", "cento", "kit"])
    .order("sort");
  if (error) throw new Error(`Could not load made-to-order products: ${error.message}`);

  return data.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    type: p.type as MadeToOrderProduct["type"],
    priceCents: p.price_cents,
    imageUrl: productImageUrl([...p.product_images].sort((a, b) => a.sort - b.sort)[0]?.path ?? null),
    leadTimeHours: p.lead_time_hours,
    weightsKg: p.weights_kg.map(Number),
    formats: p.formats,
    minQty: p.min_qty,
    stepQty: p.step_qty,
    kitContents: p.kit_contents,
    storeIds: p.store_ids,
    // Inactive addons are hidden by RLS (addon comes back null).
    addons: p.product_addons
      .map((link) => link.addon)
      .filter((addon): addon is NonNullable<typeof addon> => addon !== null)
      .sort((a, b) => a.sort - b.sort)
      .map((addon) => ({ id: addon.id, name: addon.name, priceCents: addon.price_cents })),
  }));
}

export type ProductPage = {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: "vitrine" | "bolo_kg" | "cento" | "kit";
  priceCents: number;
  images: { url: string; alt: string }[];
  stores: { id: string; slug: string; name: string; availableQty: number | null }[];
};

export async function getProductPage(slug: string): Promise<ProductPage | null> {
  const supabase = await createPublicClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("id, slug, name, description, type, price_cents, store_ids, product_images(path, alt, sort)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Could not load product: ${error.message}`);
  if (!product) return null;

  const [{ data: stores, error: storesError }, { data: availability, error: availabilityError }] = await Promise.all([
    supabase.from("stores").select("id, slug, name").order("sort"),
    supabase.from("product_availability").select("store_id, quantity").eq("product_id", product.id),
  ]);
  if (storesError ?? availabilityError) throw new Error("Could not load product availability");

  const quantities = new Map((availability ?? []).map((row) => [row.store_id, row.quantity ?? 0]));
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    type: product.type,
    priceCents: product.price_cents,
    images: [...product.product_images]
      .sort((a, b) => a.sort - b.sort)
      .map((image) => ({ url: productImageUrl(image.path), alt: image.alt || product.name })),
    stores: (stores ?? [])
      .filter((store) => product.store_ids.length === 0 || product.store_ids.includes(store.id))
      .map((store) => ({
        ...store,
        availableQty: product.type === "vitrine" ? (quantities.get(store.id) ?? 0) : null,
      })),
  };
}

export type PublicOrder = OrderSummary & {
  status: "novo" | "confirmado" | "em_producao" | "pronto" | "entregue" | "cancelado" | "expirado";
  created_at: string;
  expires_at: string | null;
  has_made_to_order: boolean;
};

export async function getOrderPublic(code: string, token: string): Promise<PublicOrder | null> {
  if (!/^C67-\d{6}$/.test(code) || !/^[0-9a-f]{32}$/.test(token)) return null;
  const supabase = await createPublicClient();
  const { data, error } = await supabase.rpc("get_order_public", { p_code: code, p_token: token });
  if (error) throw new Error(`Could not load order: ${error.message}`);
  return (data as PublicOrder | null) ?? null;
}

export type PublicSettings = {
  reservation_minutes: number;
  order_whatsapp_template: string;
  privacy_text: string;
};

export async function getPublicSettings(): Promise<PublicSettings> {
  const supabase = await createPublicClient();
  const { data, error } = await supabase.rpc("get_public_settings");
  if (error || !data) throw new Error(`Could not load settings: ${error?.message ?? "empty"}`);
  return data as PublicSettings;
}
