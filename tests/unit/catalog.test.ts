import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { isSoldInStore, productImageUrl } = await import("@/lib/catalog");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
});

describe("productImageUrl", () => {
  it("builds the public Storage URL", () => {
    expect(productImageUrl("seed/banoffee.webp")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/produtos/seed/banoffee.webp",
    );
  });

  it("falls back to the placeholder without an image", () => {
    expect(productImageUrl(null)).toBe("/placeholder-product.svg");
  });
});

describe("isSoldInStore", () => {
  it("treats an empty list as every store", () => {
    expect(isSoldInStore([], "store-1")).toBe(true);
  });

  it("checks membership otherwise", () => {
    expect(isSoldInStore(["store-1"], "store-1")).toBe(true);
    expect(isSoldInStore(["store-1"], "store-2")).toBe(false);
  });
});
