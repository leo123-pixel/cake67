import Link from "next/link";
import { CartButton } from "@/components/site/cart-button";
import { Logo } from "@/components/site/logo";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-peach/20 bg-olive/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] items-center gap-4 px-4 py-3 sm:gap-6 sm:px-8">
          <Link href="/" aria-label="Cake 67, início" className="shrink-0 text-peach">
            <Logo />
          </Link>
          <nav aria-label="Principal" className="ml-auto flex items-center gap-4 text-xs font-medium tracking-[0.16em] uppercase sm:gap-5">
            <Link href="/cardapio" className="hover:text-peach">
              Cardápio
            </Link>
            <Link href="/encomendas" className="hover:text-peach">
              Encomendas
            </Link>
            <Link href="/#lojas" className="hidden hover:text-peach sm:inline">
              Lojas
            </Link>
          </nav>
          <CartButton />
        </div>
      </header>

      <main>{children}</main>

      <footer className="bg-olive-deep">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-4 py-12 text-sm sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div className="space-y-3 text-peach">
            <Logo />
            <p className="text-linen/80">Doceria em Campo Grande/MS · Instagram @cake67cg</p>
          </div>
          <div className="space-y-1 text-linen/60 sm:text-right">
            <Link href="/privacidade" className="underline hover:text-peach">
              Privacidade
            </Link>
            <p>© {new Date().getFullYear()} Cake 67 Confeitaria e Doceria</p>
          </div>
        </div>
      </footer>
    </>
  );
}
