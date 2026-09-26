import Link from "next/link";
import { listStores } from "@/lib/catalog";

export default async function HomePage() {
  const stores = await listStores();

  return (
    <>
      <section className="mx-auto max-w-[1320px] px-4 py-20 sm:px-8 sm:py-28">
        <p className="text-xs font-medium tracking-[0.32em] text-peach uppercase">
          Doceria · Campo Grande · MS
        </p>
        <h1 className="mt-6 max-w-[16ch] text-5xl text-peach-light sm:text-7xl">
          Bolos, fatias e docinhos <em className="text-peach">feitos pra celebrar.</em>
        </h1>
        <p className="mt-6 max-w-[52ch] text-linen/85">
          Veja o que tem na vitrine de cada loja hoje e faça seu pedido.
        </p>
        <Link
          href="/cardapio"
          className="mt-10 inline-flex rounded-full bg-peach px-7 py-3.5 text-xs font-semibold tracking-[0.14em] text-cocoa uppercase transition hover:-translate-y-0.5"
        >
          Ver a vitrine de hoje
        </Link>
      </section>

      <section id="lojas" className="bg-linen text-cocoa">
        <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-8">
          <p className="text-xs font-medium tracking-[0.32em] text-raspberry uppercase">
            Nossas lojas
          </p>
          <h2 className="mt-4 text-4xl text-olive sm:text-5xl">Passa pra um café.</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {stores.map((store) => (
              <li key={store.id} className="rounded-2xl border border-cocoa/15 p-6">
                <h3 className="text-2xl text-olive">{store.name}</h3>
                <p className="mt-1 text-cocoa-soft">{store.address} · Campo Grande/MS</p>
                <Link
                  href={`/cardapio?loja=${store.slug}`}
                  className="mt-5 inline-flex rounded-full bg-olive px-6 py-3 text-xs font-semibold tracking-[0.14em] text-linen uppercase"
                >
                  Ver a vitrine
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
