// Stage 02: what an attendant and an admin can write, through the real API.
// Creates throwaway users (random password kept in memory only) and removes
// everything it created in afterAll.
import { existsSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

type Client = SupabaseClient<Database>;
const options = { auth: { persistSession: false, autoRefreshToken: false } };

const run = randomUUID().slice(0, 8);
const service = configured ? createClient<Database>(url!, serviceKey!, options) : null;
const created = { users: [] as string[], categories: [] as string[], highlights: [] as string[], files: [] as string[] };

async function signedInAs(role: "admin" | "atendente", storeId: string | null): Promise<Client> {
  const email = `qa-${role}-${run}@cake67.test`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await service!.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.users.push(data.user.id);

  const { error: staffError } = await service!
    .from("staff")
    .insert({ user_id: data.user.id, name: `QA ${role}`, role, store_id: storeId });
  if (staffError) throw staffError;

  const client = createClient<Database>(url!, anonKey!, options);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return client;
}

let admin: Client;
let attendant: Client;
let attendantId: string;
let categoryIds: string[];

beforeAll(async () => {
  if (!configured) return;
  const { data: store } = await service!.from("stores").select("id").eq("slug", "afonso-pena").single();
  admin = await signedInAs("admin", null);
  attendant = await signedInAs("atendente", store!.id);
  attendantId = created.users[1];
  const { data } = await service!.from("categories").select("id").order("sort");
  categoryIds = data!.map((row) => row.id);
});

afterAll(async () => {
  if (!configured) return;
  if (created.files.length) await service!.storage.from("produtos").remove(created.files);
  if (created.highlights.length) await service!.from("highlights").delete().in("id", created.highlights);
  if (created.categories.length) await service!.from("categories").delete().in("id", created.categories);
  await service!.rpc("reorder", { p_table: "categories", p_ids: categoryIds }).then(() => undefined, () => undefined);
  // Deleting the auth user cascades to staff.
  for (const id of created.users) await service!.auth.admin.deleteUser(id);
});

describe.skipIf(!configured)("attendant cannot change the catalog", () => {
  it("cannot insert products, categories, addons, stores or highlights", async () => {
    const { data: category } = await service!.from("categories").select("id").limit(1).single();
    const attempts = await Promise.all([
      attendant.from("products").insert({ slug: `qa-${run}`, name: "x", category_id: category!.id, type: "vitrine", price_cents: 1 }),
      attendant.from("categories").insert({ slug: `qa-${run}`, name: "x", kind: "vitrine" }),
      attendant.from("addons").insert({ name: `qa-${run}`, price_cents: 1 }),
      attendant.from("stores").insert({ slug: `qa-${run}`, name: "x", address: "x", whatsapp: "5567999999999" }),
      attendant.from("highlights").insert({ slot: "banner", title: "x" }),
    ]);
    for (const { error } of attempts) expect(error?.code).toBe("42501");
  });

  it("updates change nothing", async () => {
    const updates = await Promise.all([
      attendant.from("products").update({ price_cents: 1 }).neq("slug", "").select("id"),
      attendant.from("categories").update({ name: "x" }).neq("slug", "").select("id"),
      attendant.from("stores").update({ name: "x" }).neq("slug", "").select("id"),
      attendant.from("addons").update({ price_cents: 1 }).neq("name", "").select("id"),
    ]);
    for (const { data } of updates) expect(data ?? []).toHaveLength(0);
  });

  it("cannot manage staff", async () => {
    const { data } = await attendant.from("staff").update({ role: "admin" }).eq("user_id", attendantId).select("user_id");
    expect(data ?? []).toHaveLength(0);
    const { error } = await attendant.from("staff").insert({ user_id: randomUUID(), name: "x", role: "admin" });
    expect(error?.code).toBe("42501");
  });

  it("cannot upload product photos", async () => {
    const path = `products/qa-${run}/${randomUUID()}.webp`;
    const { error } = await attendant.storage.from("produtos").upload(path, new Blob(["x"], { type: "image/webp" }));
    if (!error) created.files.push(path);
    expect(error).not.toBeNull();
  });

  it("reorder and set_product_addons have no effect", async () => {
    await attendant.rpc("reorder", { p_table: "categories", p_ids: [...categoryIds].reverse() });
    const { data } = await service!.from("categories").select("id").order("sort");
    expect(data!.map((row) => row.id)).toEqual(categoryIds);

    const { data: cake } = await service!.from("products").select("id").eq("slug", "bolo-ninho-morango").single();
    const { data: addon } = await service!.from("addons").select("id").eq("name", "Velas").single();
    const count = async () =>
      (await service!.from("product_addons").select("addon_id", { count: "exact", head: true }).eq("product_id", cake!.id)).count;
    const before = await count();

    // Removing is silently filtered by RLS; inserting is rejected.
    await attendant.rpc("set_product_addons", { p_product_id: cake!.id, p_addon_ids: [] });
    const { error } = await attendant.rpc("set_product_addons", { p_product_id: cake!.id, p_addon_ids: [addon!.id] });
    expect(error?.code).toBe("42501");
    expect(await count()).toBe(before);
  });
});

describe.skipIf(!configured)("admin manages the catalog", () => {
  it("creates and edits a category", async () => {
    const { data, error } = await admin
      .from("categories")
      .insert({ slug: `qa-${run}`, name: `QA ${run}`, kind: "vitrine", active: false })
      .select("id")
      .single();
    expect(error).toBeNull();
    created.categories.push(data!.id);

    const { data: updated } = await admin.from("categories").update({ name: "QA renamed" }).eq("id", data!.id).select("name");
    expect(updated?.[0]?.name).toBe("QA renamed");
  });

  it("reorders through the rpc", async () => {
    const reversed = [...categoryIds].reverse();
    const { error } = await admin.rpc("reorder", { p_table: "categories", p_ids: reversed });
    expect(error).toBeNull();
    const { data } = await service!.from("categories").select("id").in("id", categoryIds).order("sort");
    expect(data!.map((row) => row.id)).toEqual(reversed);
    await admin.rpc("reorder", { p_table: "categories", p_ids: categoryIds });
  });

  it("uploads and removes a product photo", async () => {
    const path = `products/qa-${run}/${randomUUID()}.webp`;
    const { error } = await admin.storage.from("produtos").upload(path, new Blob(["x"], { type: "image/webp" }));
    expect(error).toBeNull();
    const { data: removed } = await admin.storage.from("produtos").remove([path]);
    expect(removed).toHaveLength(1);
  });

  it("creates a highlight", async () => {
    const { data, error } = await admin.from("highlights").insert({ slot: "banner", title: `QA ${run}`, active: false }).select("id").single();
    expect(error).toBeNull();
    created.highlights.push(data!.id);
  });

  it("deactivates an attendant, who then loses the staff row check", async () => {
    const { error } = await admin.from("staff").update({ active: false }).eq("user_id", attendantId);
    expect(error).toBeNull();
    const { data } = await attendant.from("staff").select("active").eq("user_id", attendantId).single();
    expect(data?.active).toBe(false);
  });
});

describe.skipIf(!configured)("public visibility", () => {
  it("anon never sees a product with pending price", async () => {
    const anon = createClient<Database>(url!, anonKey!, options);
    const { data } = await anon.from("products").select("id").eq("price_pending", true);
    expect(data).toHaveLength(0);
    const { data: cake } = await anon.from("products").select("id").eq("slug", "bolo-ninho-morango");
    expect(cake).toHaveLength(0);
  });
});
