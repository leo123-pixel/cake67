import type { Metadata } from "next";
import { ProductCard } from "@/components/site/product-card";
import { StorePicker } from "@/components/site/store-picker";
import { listStores, listVitrineMenu } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Cardápio",
  description: "Fatias, potes, croissants e docinhos na vitrine das lojas Cake 67 hoje.",
};

type Props = { searchParams: Promise<{ loja?: string | string[] }> };

export default async function MenuPage({ searchParams }: Props) {
  const { loja } = await searchParams;
  const stores = await listStores();
  const store = stores.find((s) => s.slug === loja) ?? stores[0];

  if (!store) {
    return <p className="mx-auto max-w-[1320px] px-4 py-20 sm:px-8">Nenhuma loja disponível no momento.</p>;
  }

  const menu = await listVitrineMenu(store.id);

  return (
    <section className="mx-auto max-w-[1320px] px-4 py-14 sm:px-8 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-medium tracking-[0.32em] text-peach uppercase">Pronta entrega</p>
          <h1 className="mt-3 text-4xl text-peach sm:text-6xl">Na vitrine hoje</h1>
        </div>
        <StorePicker stores={stores} current={store.slug} />
      </div>

      {menu.length > 0 && (
        <nav aria-label="Categorias" className="mt-8 flex flex-wrap gap-2 border-b border-peach/25 pb-3">
          {menu.map((category) => (
            <a
              key={category.id}
              href={`#${category.slug}`}
              className="px-3 py-2 text-xs tracking-[0.2em] text-linen/80 uppercase hover:text-peach"
            >
              {category.name}
            </a>
          ))}
        </nav>
      )}

      {menu.length === 0 && (
        <p className="mt-10 text-linen/80">Nenhum produto na vitrine desta loja no momento.</p>
      )}

      {menu.map((category) => (
        <section key={category.id} id={category.slug} className="mt-10 scroll-mt-24">
          <h2 className="text-2xl text-peach-light">{category.name}</h2>
          <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-peach/20 bg-peach/20 md:grid-cols-2">
            {category.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
