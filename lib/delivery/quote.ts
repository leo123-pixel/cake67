import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { addressKey } from "./address";
import { estimateDelivery, listCategories, readMachineConfig, type Category, type DeliveryAddress } from "./machine";
import { deliverySetupProblem } from "./setup";

// Spec 11: a quote is valid for 30 minutes (create_order accepts 35 to cover
// the time between this check and the insert). A failure is reused for 2
// minutes so a customer retyping does not hit Juma again and again.
export const QUOTE_TTL_MINUTES = 30;
const FAILURE_TTL_MINUTES = 2;
// Brake against a script hammering Juma through the checkout.
const MAX_QUOTES_PER_STORE_PER_MINUTE = 60;

export type DeliveryQuote =
  | { ok: true; quoteId: string; feeCents: number }
  | { ok: false; reason: "not_configured" | "failed" | "busy" };

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

// Never throws: any failure means "a combinar" (spec 11, D4).
export async function getDeliveryQuote(storeId: string, to: DeliveryAddress): Promise<DeliveryQuote> {
  try {
    return await quote(storeId, to);
  } catch (error) {
    console.error(`delivery quote: ${String(error).slice(0, 300)}`);
    return { ok: false, reason: "failed" };
  }
}

async function quote(storeId: string, to: DeliveryAddress): Promise<DeliveryQuote> {
  const config = readMachineConfig();
  const supabase = createAdminClient();

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("active, address_street, address_number, address_district, delivery_category_id")
    .eq("id", storeId)
    .maybeSingle();
  if (storeError) {
    console.error(`delivery quote: store ${storeError.message}`);
    return { ok: false, reason: "failed" };
  }
  if (!store?.active || !config || deliverySetupProblem(store, true)) return { ok: false, reason: "not_configured" };

  const key = addressKey(to);
  const { data: recent, error: recentError } = await supabase
    .from("delivery_quotes")
    .select("id, status, fee_cents, created_at")
    .eq("store_id", storeId)
    .eq("address_key", key)
    .eq("category_id", store.delivery_category_id!)
    .gte("created_at", minutesAgo(QUOTE_TTL_MINUTES - 1))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentError) console.error(`delivery quote: lookup ${recentError.message}`);
  if (recent?.status === "ok" && recent.fee_cents) return { ok: true, quoteId: recent.id, feeCents: recent.fee_cents };
  if (recent?.status === "falhou" && recent.created_at >= minutesAgo(FAILURE_TTL_MINUTES)) return { ok: false, reason: "failed" };

  const { count } = await supabase
    .from("delivery_quotes")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .gte("created_at", minutesAgo(1));
  if ((count ?? 0) >= MAX_QUOTES_PER_STORE_PER_MINUTE) {
    console.error(`delivery quote: brake on store ${storeId}`);
    return { ok: false, reason: "busy" };
  }

  const from = { street: store.address_street!, number: store.address_number!, district: store.address_district! };
  const estimate = await estimateDelivery(config, from, to, store.delivery_category_id!);
  if (!estimate.ok) console.error(`delivery quote: juma ${estimate.error}`);

  const { data: saved, error: saveError } = await supabase
    .from("delivery_quotes")
    .insert({
      store_id: storeId,
      address_key: key,
      street: to.street,
      number: to.number,
      district: to.district,
      category_id: store.delivery_category_id,
      ...(estimate.ok
        ? { status: "ok" as const, fee_cents: estimate.feeCents, km: estimate.km, minutes: estimate.minutes }
        : { status: "falhou" as const, error: estimate.error }),
    })
    .select("id")
    .single();
  if (saveError) {
    console.error(`delivery quote: save ${saveError.message}`);
    return { ok: false, reason: "failed" };
  }
  return estimate.ok ? { ok: true, quoteId: saved.id, feeCents: estimate.feeCents } : { ok: false, reason: "failed" };
}

export function hasJumaCredentials(): boolean {
  return readMachineConfig() !== null;
}

export type JumaCategories =
  | { status: "ok"; categories: Category[] }
  | { status: "no_credentials" }
  | { status: "failed" };

// Category list for the store form (admin). A failure keeps the saved category.
export async function loadJumaCategories(): Promise<JumaCategories> {
  const config = readMachineConfig();
  if (!config) return { status: "no_credentials" };
  const result = await listCategories(config);
  if (!result.ok) {
    console.error(`juma categories: ${result.error}`);
    return { status: "failed" };
  }
  return { status: "ok", categories: result.categories };
}
