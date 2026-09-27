import Link from "next/link";

// Same 404 for unknown routes, inactive products and order links without a token.
export function NotFoundPanel() {
  return (
    <section className="mx-auto flex max-w-[1320px] flex-col items-start gap-6 px-4 py-24 text-linen sm:px-8">
      <h1 className="text-4xl text-peach sm:text-5xl">Não encontramos esta página.</h1>
      <p className="max-w-[48ch] text-linen/80">
        O link pode estar incompleto ou o produto saiu do cardápio. Veja o que tem hoje na vitrine.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/cardapio"
          className="inline-flex min-h-11 items-center rounded-full bg-peach px-7 text-xs font-semibold tracking-[0.14em] text-cocoa uppercase"
        >
          Ver cardápio
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-full border border-peach/60 px-7 text-xs font-semibold tracking-[0.14em] text-peach uppercase"
        >
          Início
        </Link>
      </div>
    </section>
  );
}
