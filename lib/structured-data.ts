// schema.org JSON-LD for local SEO (SPEC §10): Bakery per store, Product per page.
import type { ProductPage } from "@/lib/storefront";
import { parseStoredHours, WEEK_DAYS, type WeekDay } from "@/lib/validators/store";

const SCHEMA_DAYS: Record<WeekDay, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export type SeoStore = { name: string; address: string; phone: string | null; hours: unknown };

export function bakeryJsonLd(store: SeoStore, siteUrl: string) {
  const hours = parseStoredHours(store.hours);
  return {
    "@context": "https://schema.org",
    "@type": "Bakery",
    name: `Cake 67 · ${store.name}`,
    url: siteUrl,
    image: `${siteUrl}/brand/logo-mark.png`,
    ...(store.phone ? { telephone: store.phone } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: store.address,
      addressLocality: "Campo Grande",
      addressRegion: "MS",
      addressCountry: "BR",
    },
    openingHoursSpecification: WEEK_DAYS.flatMap((day) => {
      const open = hours[day];
      return open
        ? [{ "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${SCHEMA_DAYS[day]}`, opens: open.open, closes: open.close }]
        : [];
    }),
  };
}

type SeoProduct = Pick<ProductPage, "slug" | "name" | "description" | "type" | "priceCents" | "images"> & {
  stores: { availableQty: number | null }[];
};

export function productJsonLd(product: SeoProduct, siteUrl: string) {
  const url = `${siteUrl}/produto/${product.slug}`;
  const inStock = product.stores.some((store) => (store.availableQty ?? 0) > 0);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.images.length ? { image: product.images.map((image) => image.url) } : {}),
    url,
    brand: { "@type": "Brand", name: "Cake 67" },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "BRL",
      price: (product.priceCents / 100).toFixed(2),
      // Made-to-order items have no stock: availability depends on the date.
      ...(product.type === "vitrine" || product.type === "vitrine_kg"
        ? { availability: `https://schema.org/${inStock ? "InStock" : "OutOfStock"}` }
        : {}),
      // Weighed showcase cakes: the price is per kg.
      ...(product.type === "vitrine_kg"
        ? {
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: (product.priceCents / 100).toFixed(2),
              priceCurrency: "BRL",
              referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "KGM" },
            },
          }
        : {}),
    },
  };
}

// Safe inside <script>: "<" never closes the tag.
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
