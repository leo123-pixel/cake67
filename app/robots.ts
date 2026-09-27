import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

// Only the production deployment is indexed; previews and local runs are not.
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/carrinho", "/checkout", "/pedido"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
