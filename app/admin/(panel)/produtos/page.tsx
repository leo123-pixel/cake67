import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/status-badge";
import { listAdminCategories } from "@/lib/admin/catalog";
import { listAdminProducts } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth";
import { productImageUrl } from "@/lib/images";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = { title: "Produtos" };

const TYPE_LABELS = { vitrine: "Vitrine", bolo_kg: "Bolo por kg", cento: "Cento", kit: "Kit" } as const;

type Props = { searchParams: Promise<{ categoria?: string; busca?: string }> };

export default async function ProductsPage({ searchParams }: Props) {
  const { supabase } = await requireAdmin();
  const { categoria, busca } = await searchParams;
  const [categories, products] = await Promise.all([
    listAdminCategories(supabase),
    listAdminProducts(supabase, { categoryId: categoria || undefined, search: busca?.trim() || undefined }),
  ]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl text-olive">Produtos</h1>
        <Link href="/admin/produtos/novo" className="btn btn-primary">
          Novo produto
        </Link>
      </header>

      <form className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
        <input name="busca" defaultValue={busca} placeholder="Buscar pelo nome" aria-label="Buscar pelo nome" className="field-input" />
        <select name="categoria" defaultValue={categoria ?? ""} aria-label="Categoria" className="field-input">
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary">
          Filtrar
        </button>
      </form>

      {products.length === 0 ? (
        <p className="text-cocoa-soft">Nenhum produto encontrado.</p>
      ) : (
        <ul className="divide-y divide-cocoa/10 overflow-hidden rounded-2xl border border-cocoa/10 bg-white">
          {products.map((product) => (
            <li key={product.id}>
              <Link href={`/admin/produtos/${product.id}`} className="flex items-center gap-3 p-3 hover:bg-olive/5">
                <Image
                  src={productImageUrl(product.coverPath)}
                  alt=""
                  width={56}
                  height={56}
                  unoptimized={!product.coverPath}
                  className="size-14 shrink-0 rounded-xl bg-olive object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{product.name}</p>
                  <p className="truncate text-sm text-cocoa-soft">
                    {product.categoryName} · {TYPE_LABELS[product.type]}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                  {product.price_pending ? (
                    <StatusBadge tone="amber">Preço a definir</StatusBadge>
                  ) : (
                    <span className="tabular-nums">{formatBRL(product.price_cents)}</span>
                  )}
                  {!product.active && <StatusBadge tone="gray">Inativo</StatusBadge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
