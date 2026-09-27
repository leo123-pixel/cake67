import { jsonLdScript } from "@/lib/structured-data";

// Structured data for search engines; the content comes from our own database.
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />;
}
