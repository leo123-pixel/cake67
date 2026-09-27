import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/site/add-to-cart";
import { formatBRL } from "@/lib/money";
import { getProductPage } from "@/lib/storefront";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductPage((await params).slug);
  return product ? { title: product.name, description: product.description || undefined } : {};
}

const UNIT = { vitrine: "", bolo_kg: " o kg", cento: " o cento", kit: "" } as const;

export default async function ProductPage({ params }: Props) {
  const product = await getProductPage((await params).slug);
  if (!product) notFound();

  const [cover, ...others] = product.images;

  return (
    <div className="bg-linen text-cocoa">
      <section className="mx-auto grid max-w-[1100px] gap-8 px-4 py-12 sm:px-8 md:grid-cols-2">
        <div className="space-y-3">
          <div className="grid aspect-square place-items-center rounded-3xl bg-olive p-6">
            {cover ? (
              <Image src={cover.url} alt={cover.alt} width={520} height={520} priority className="max-h-full w-auto object-contain" />
            ) : (
              <span className="text-linen/70">Sem foto</span>
            )}
          </div>
          {others.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {others.map((image) => (
                <Image key={image.url} src={image.url} alt={image.alt} width={120} height={120} className="aspect-square rounded-xl bg-olive object-contain p-1" />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <h1 className="text-4xl text-olive">{product.name}</h1>
          {product.description && <p className="text-cocoa-soft">{product.description}</p>}
          <p className="text-2xl tabular-nums text-olive">
            {formatBRL(product.priceCents)}
            <span className="text-base text-cocoa-soft">{UNIT[product.type]}</span>
          </p>

          {product.type === "vitrine" ? (
            <ul className="space-y-2">
              {product.stores.map((store) => (
                <li key={store.id} className="flex items-center justify-between gap-3 rounded-2xl bg-olive p-4 text-linen">
                  <span>{store.name}</span>
                  {store.availableQty ? (
                    <AddToCart
                      productId={product.id}
                      name={product.name}
                      imageUrl={cover?.url ?? "/placeholder-product.svg"}
                      availableQty={store.availableQty}
                      storeSlug={store.slug}
                    />
                  ) : (
                    <span className="text-xs tracking-[0.12em] text-peach uppercase">Esgotado</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Link href="/encomendas" className="btn btn-primary">
              Montar encomenda
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
