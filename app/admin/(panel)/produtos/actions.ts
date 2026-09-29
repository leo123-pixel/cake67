"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFailure, isUniqueViolation, nextSort, uniqueSlug } from "@/lib/admin/common";
import { getAdminContext, NOT_ALLOWED } from "@/lib/auth";
import { getAdminProduct } from "@/lib/admin/products";
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
  if (parsed.data.type === "vitrine_kg") {
    const { data: category } = await supabase.from("categories").select("kind").eq("id", parsed.data.category_id).maybeSingle();
    if (category?.kind !== "vitrine") {
      return {
        ok: false,
        message: "Confira os campos destacados.",
        fieldErrors: { category_id: ["Bolo inteiro da vitrine precisa de uma categoria de vitrine"] },
        values,
      };
    }
  }
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

// Only products that never appeared in an order (CK040 otherwise).
export async function deleteProduct(productId: string): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;
  if (!uuid.safeParse(productId).success) return { ok: false, message: "Produto inválido." };

  const { supabase } = context;
  const { data: paths, error } = await supabase.rpc("delete_product", { p_product_id: productId });
  if (error) return dbFailure("deleteProduct", error);

  // Row first, files second: orphan files are harmless. Only files uploaded
  // for this product: seed photos (seed/...) are shared by other products.
  const ownFiles = paths.filter((path) => path.startsWith(`products/${productId}/`));
  if (ownFiles.length > 0) {
    const { error: storageError } = await supabase.storage.from(PRODUCT_BUCKET).remove(ownFiles);
    if (storageError) console.error(`deleteProduct files: ${storageError.message}`);
  }

  revalidateCatalog();
  return { ok: true, message: "Produto excluído." };
}

function revalidateCatalog() {
  revalidatePath("/admin/produtos", "layout");
  revalidatePath("/admin/estoque", "layout");
}

// "Ativar / desativar" from the lists: same as the "Mostrar no site" checkbox.
export async function setProductActive(productId: string, active: boolean): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;
  if (!uuid.safeParse(productId).success) return { ok: false, message: "Produto inválido." };

  const { error } = await context.supabase.from("products").update({ active }).eq("id", productId);
  if (error) return dbFailure("setProductActive", error);

  revalidateCatalog();
  return { ok: true };
}

// Copy for a similar flavor: same data, addons and photos, hidden from the
// site until reviewed. Photos are copied to the new product's own folder so
// deleting either product never removes the other's files.
export async function duplicateProduct(productId: string): Promise<ActionState> {
  const context = await getAdminContext();
  if (!context) return NOT_ALLOWED;
  if (!uuid.safeParse(productId).success) return { ok: false, message: "Produto inválido." };

  const { supabase } = context;
  const detail = await getAdminProduct(supabase, productId);
  if (!detail) return { ok: false, message: "Produto não encontrado." };

  const source = detail.product;
  const name = `${source.name} (cópia)`;
  const insert = async () =>
    supabase
      .from("products")
      .insert({
        category_id: source.category_id,
        description: source.description,
        type: source.type,
        price_cents: source.price_cents,
        price_pending: source.price_pending,
        min_qty: source.min_qty,
        step_qty: source.step_qty,
        lead_time_hours: source.lead_time_hours,
        weights_kg: source.weights_kg,
        formats: source.formats,
        kit_contents: source.kit_contents,
        store_ids: source.store_ids,
        name,
        active: false,
        featured: false,
        slug: await uniqueSlug(supabase, "products", name),
        sort: await nextSort(supabase, "products"),
      })
      .select("id")
      .single();
  let result = await insert();
  if (isUniqueViolation(result.error)) result = await insert();
  if (result.error) return dbFailure("duplicateProduct", result.error);
  const copyId = result.data.id;

  const { error: addonError } = await supabase.rpc("set_product_addons", {
    p_product_id: copyId,
    p_addon_ids: detail.addonIds,
  });
  if (addonError) return dbFailure("duplicateProductAddons", addonError);

  for (const image of detail.images) {
    const path = `products/${copyId}/${crypto.randomUUID()}.webp`;
    const { error: copyError } = await supabase.storage.from(PRODUCT_BUCKET).copy(image.path, path);
    if (copyError) {
      console.error(`duplicateProduct copy ${image.path}: ${copyError.message}`);
      continue;
    }
    const { error: rowError } = await supabase
      .from("product_images")
      .insert({ product_id: copyId, path, alt: image.alt, sort: image.sort });
    if (rowError) console.error(`duplicateProduct image row: ${rowError.message}`);
  }

  revalidateCatalog();
  redirect(`/admin/produtos/${copyId}?duplicado=1`);
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
  // Seed photos (seed/...) may be shared, so only this product's own uploads go.
  if (data.path.startsWith(`products/${data.product_id}/`)) {
    const { error: storageError } = await supabase.storage.from(PRODUCT_BUCKET).remove([data.path]);
    if (storageError) console.error(`remove ${data.path}: ${storageError.message}`);
  }

  revalidatePath(`/admin/produtos/${data.product_id}`);
  return { ok: true };
}
