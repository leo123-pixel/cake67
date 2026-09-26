import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ProductForm } from "@/components/admin/product-form";
import { ProductImages } from "@/components/admin/product-images";
import { getAdminProduct, getProductFormOptions } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Editar produto" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criado?: string }>;
};

export default async function EditProductPage({ params, searchParams }: Props) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { criado } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const [detail, options] = await Promise.all([getAdminProduct(supabase, id), getProductFormOptions(supabase)]);
  if (!detail) notFound();

  const { product, images, addonIds } = detail;

  return (
    <section className="space-y-8">
      <header className="space-y-1">
        <Link href="/admin/produtos" className="text-sm text-olive underline">
          ← Produtos
        </Link>
        <h1 className="text-3xl text-olive">{product.name}</h1>
        {criado && (
          <p role="status" className="rounded-xl bg-olive/10 px-4 py-3 text-sm text-olive-dark">
            Produto criado. Agora adicione as fotos.
          </p>
        )}
      </header>

      <ProductImages productId={product.id} productName={product.name} images={images} />
      <ProductForm product={product} addonIds={addonIds} options={options} />
    </section>
  );
}
