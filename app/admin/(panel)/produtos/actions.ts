"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFailure, isUniqueViolation, nextSort, uniqueSlug } from "@/lib/admin/common";
import { getAdminContext, NOT_ALLOWED } from "@/lib/auth";
import { PRODUCT_BUCKET } from "@/lib/images";
import { invalid, readForm, type ActionState } from "@/lib/validators/common";
import { productSchema, toProductRow } from "@/lib/validators/product";

const ARRAY_FIELDS = ["store_ids", "weights_kg", "addon_ids"];

export async function saveProduct(
  productId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const values = readForm(formData, ARRAY_FIELDS);
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const { supabase } = context;
  const row = toProductRow(parsed.data);
  let id = productId;

  if (id) {
    const { error } = await supabase.from("products").update(row).eq("id", id);
    if (error) return { ...dbFailure("updateProduct", error), values };
  } else {
    const insert = async () =>
      supabase
        .from("products")
        .insert({
          ...row,
          slug: await uniqueSlug(supabase, "products", row.name),
          sort: await nextSort(supabase, "products"),
        })
        .select("id")
        .single();
    let result = await insert();
    if (isUniqueViolation(result.error)) result = await insert();
    if (result.error) return { ...dbFailure("createProduct", result.error), values };
    id = result.data.id;
  }

  const addonIds = parsed.data.type === "bolo_kg" ? parsed.data.addon_ids : [];
  const { error: addonError } = await supabase.rpc("set_product_addons", {
    p_product_id: id,
    p_addon_ids: addonIds,
  });
  if (addonError) return { ...dbFailure("setProductAddons", addonError), values };

  revalidatePath("/admin/produtos", "layout");
  if (!productId) redirect(`/admin/produtos/${id}?criado=1`);
  return { ok: true, message: "Produto salvo." };
}

// --- photos ---------------------------------------------------------------

const uuid = z.uuid();

export async function addProductImage(productId: string, path: string): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const expected = new RegExp(`^products/${productId}/[0-9a-f-]{36}\\.webp$`);
  if (!uuid.safeParse(productId).success || !expected.test(path)) {
    return { ok: false, message: "Foto inválida." };
  }

  const { supabase } = context;
  const { data: last } = await supabase
    .from("product_images")
    .select("sort")
    .eq("product_id", productId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("product_images")
    .insert({ product_id: productId, path, sort: (last?.sort ?? 0) + 1 });
  if (error) {
    // Never keep a file without its row.
    await supabase.storage.from(PRODUCT_BUCKET).remove([path]);
    return dbFailure("addProductImage", error);
  }

  revalidatePath(`/admin/produtos/${productId}`);
  return { ok: true };
}

export async function updateImageAlt(imageId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const alt = String(formData.get("alt") ?? "").trim().slice(0, 200);
  const { error } = await context.supabase.from("product_images").update({ alt }).eq("id", imageId);
  if (error) return dbFailure("updateImageAlt", error);
  return { ok: true, message: "Salvo." };
}

export async function removeProductImage(imageId: string): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;

  const { supabase } = context;
  const { data, error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .select("path, product_id")
    .maybeSingle();
  if (error) return dbFailure("removeProductImage", error);
  if (!data) return { ok: false, message: "Foto não encontrada." };

  // Row first, file second: an orphan file is harmless, an orphan row is not.
  const { error: storageError } = await supabase.storage.from(PRODUCT_BUCKET).remove([data.path]);
  if (storageError) console.error(`remove ${data.path}: ${storageError.message}`);

  revalidatePath(`/admin/produtos/${data.product_id}`);
  return { ok: true };
}
