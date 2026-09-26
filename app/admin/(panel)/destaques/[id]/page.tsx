import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getAdminHighlight, listProductChoices } from "@/lib/admin/highlights";
import { requireAdmin } from "@/lib/auth";
import { HighlightForm } from "../highlight-form";

export const metadata: Metadata = { title: "Destaque" };

type Props = { params: Promise<{ id: string }> };

// "novo" creates a highlight; any other segment must be an existing id.
export default async function HighlightPage({ params }: Props) {
  const { supabase } = await requireAdmin();
  const { id } = await params;

  let highlight;
  if (id !== "novo") {
    if (!z.uuid().safeParse(id).success) notFound();
    highlight = await getAdminHighlight(supabase, id);
    if (!highlight) notFound();
  }
  const products = await listProductChoices(supabase);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <Link href="/admin/destaques" className="text-sm text-olive underline">
          ← Destaques
        </Link>
        <h1 className="text-3xl text-olive">{highlight?.title ?? "Novo destaque"}</h1>
      </header>
      <HighlightForm highlight={highlight ?? undefined} products={products} />
    </section>
  );
}
