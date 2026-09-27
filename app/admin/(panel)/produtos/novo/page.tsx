import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";
import { getProductFormOptions } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  const { supabase } = await requireAdmin();
  const options = await getProductFormOptions(supabase);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <Link href="/admin/produtos" className="text-sm text-olive underline">
          ← Produtos
        </Link>
        <h1 className="text-3xl text-olive">Novo produto</h1>
        <p className="text-sm text-cocoa-soft">As fotos entram depois de criar o produto.</p>
      </header>
      <ProductForm options={options} />
    </section>
  );
}
