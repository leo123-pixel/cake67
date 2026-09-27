import type { Metadata } from "next";
import Link from "next/link";
import { BulkItemCard } from "@/components/site/bulk-item-card";
import { CakeConfigurator } from "@/components/site/cake-configurator";
import { listMadeToOrder } from "@/lib/storefront";

export const metadata: Metadata = {
  title: "Encomendas",
  description: "Monte seu bolo por kg, peça salgados e doces por cento ou kits festa da Cake 67.",
};

export default async function MadeToOrderPage() {
  const products = await listMadeToOrder();
  const cakes = products.filter((p) => p.type === "bolo_kg" && p.weightsKg.length > 0 && p.formats.length > 0);
  const centos = products.filter((p) => p.type === "cento");
  const kits = products.filter((p) => p.type === "kit");

  return (
    <div className="bg-linen text-cocoa">
      <section className="mx-auto max-w-[1320px] space-y-12 px-4 py-14 sm:px-8 sm:py-20">
        <header className="space-y-3">
          <p className="text-xs font-medium tracking-[0.32em] text-raspberry uppercase">Encomendas</p>
          <h1 className="text-4xl text-olive sm:text-6xl">Monte sua encomenda</h1>
          <p className="max-w-[56ch] text-cocoa-soft">
            Escolha o bolo, o peso e os detalhes. A data de retirada ou entrega você escolhe no checkout, respeitando a
            antecedência de cada item.
          </p>
        </header>

        {products.length === 0 && (
          <div className="space-y-4 rounded-3xl border border-cocoa/10 bg-white p-8">
            <p className="text-lg">Estamos atualizando o cardápio de encomendas.</p>
            <p className="text-cocoa-soft">Enquanto isso, veja a vitrine de hoje ou fale com a loja pelo WhatsApp.</p>
            <Link href="/cardapio" className="btn btn-primary">
              Ver a vitrine
            </Link>
          </div>
        )}

        {cakes.length > 0 && (
          <section aria-labelledby="bolos" className="space-y-6">
            <h2 id="bolos" className="text-3xl text-olive">
              Bolos por kg
            </h2>
            <CakeConfigurator cakes={cakes} />
          </section>
        )}

        {centos.length > 0 && (
          <section aria-labelledby="cento" className="space-y-6">
            <h2 id="cento" className="text-3xl text-olive">
              Salgados e doces por cento
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {centos.map((product) => (
                <BulkItemCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {kits.length > 0 && (
          <section aria-labelledby="kits" className="space-y-6">
            <h2 id="kits" className="text-3xl text-olive">
              Kits festa
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {kits.map((product) => (
                <BulkItemCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
