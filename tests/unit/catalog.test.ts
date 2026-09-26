import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/public", () => ({ createPublicClient: vi.fn() }));

const { isSoldInStore, toHomeHighlights } = await import("@/lib/catalog");
const { HIGHLIGHT_IMAGE_PATH } = await import("@/lib/validators/highlight");
const { productImageUrl } = await import("@/lib/images");

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

describe("toHomeHighlights", () => {
  const base = { slot: "bolo_do_mes" as const, title: "T", subtitle: null, cta_label: null, cta_href: null };

  it("drops highlights whose linked product is hidden", () => {
    const rows = [
      { ...base, id: "a", image_path: null, product_id: "p1", product: null },
      { ...base, id: "b", image_path: "highlights/x.webp", product_id: null, product: null },
    ];
    expect(toHomeHighlights(rows).map((h) => h.id)).toEqual(["b"]);
  });

  it("prefers its own image, then the product cover", () => {
    const product = { product_images: [{ path: "seed/b.webp", sort: 2 }, { path: "seed/a.webp", sort: 1 }] };
    const [own, cover] = toHomeHighlights([
      { ...base, id: "a", image_path: "highlights/own.webp", product_id: "p", product },
      { ...base, id: "b", image_path: null, product_id: "p", product },
    ]);
    expect(own.imageUrl).toContain("/produtos/highlights/own.webp");
    expect(cover.imageUrl).toContain("/produtos/seed/a.webp");
  });
});

describe("HIGHLIGHT_IMAGE_PATH", () => {
  it("accepts only uploaded highlight images", () => {
    expect(HIGHLIGHT_IMAGE_PATH.test("highlights/0b7c8a5e-8f7a-4c1e-9c55-2f4d2b1a9e01.webp")).toBe(true);
    expect(HIGHLIGHT_IMAGE_PATH.test("seed/banoffee.webp")).toBe(false);
    expect(HIGHLIGHT_IMAGE_PATH.test("highlights/../x.webp")).toBe(false);
  });
});
