import type { Metadata } from "next";
import Link from "next/link";
import { listAdminHighlights } from "@/lib/admin/highlights";
import { requireAdmin } from "@/lib/auth";
import { HighlightsList } from "./highlights-list";

export const metadata: Metadata = { title: "Destaques" };

export default async function HighlightsPage() {
  const { supabase } = await requireAdmin();
  const highlights = await listAdminHighlights(supabase);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl text-olive">Destaques da home</h1>
          <p className="text-sm text-cocoa-soft">Só os vigentes aparecem no site. Saem sozinhos quando o período termina.</p>
        </div>
        <Link href="/admin/destaques/novo" className="btn btn-primary">
          Novo destaque
        </Link>
      </header>
      {highlights.length === 0 ? (
        <p className="text-cocoa-soft">Nenhum destaque cadastrado.</p>
      ) : (
        <HighlightsList highlights={highlights} />
      )}
    </section>
  );
}
