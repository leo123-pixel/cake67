import type { Metadata } from "next";
import { listAdminCategories } from "@/lib/admin/catalog";
import { requireAdmin } from "@/lib/auth";
import { CategoriesManager } from "./categories-manager";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriesPage() {
  const { supabase } = await requireAdmin();
  const categories = await listAdminCategories(supabase);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl text-olive">Categorias</h1>
        <p className="text-sm text-cocoa-soft">A ordem aqui é a ordem do cardápio. Arraste ou use ↑/↓.</p>
      </header>
      <CategoriesManager categories={categories} />
    </section>
  );
}
