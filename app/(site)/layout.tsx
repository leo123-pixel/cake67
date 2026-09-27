import Link from "next/link";
import { Logo } from "@/components/site/logo";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-peach/20 bg-olive/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] items-center gap-6 px-4 py-3.5 sm:px-8">
          <Link href="/" aria-label="Cake 67, início" className="text-peach">
            <Logo />
          </Link>
          <nav aria-label="Principal" className="ml-auto flex gap-5 text-xs font-medium tracking-[0.2em] uppercase">
            <Link href="/cardapio" className="hover:text-peach">
              Cardápio
            </Link>
            <Link href="/#lojas" className="hover:text-peach">
              Lojas
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="bg-olive-deep">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-4 py-12 text-sm sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div className="space-y-3 text-peach">
            <Logo />
            <p className="text-linen/80">Doceria em Campo Grande/MS · Instagram @cake67cg</p>
          </div>
          <p className="text-linen/60">© {new Date().getFullYear()} Cake 67 Confeitaria e Doceria</p>
        </div>
      </footer>
    </>
  );
}
