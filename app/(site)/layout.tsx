import Link from "next/link";
import { CartButton } from "@/components/site/cart-button";
import { Toast } from "@/components/site/toast";
import { listStores } from "@/lib/catalog";
import "./prototype.css";

// Header and footer of the approved prototype (AD-012). Section links point
// at the home, so they work from every page.
const SECTIONS = [
  { href: "/#bolos", label: "Bolos" },
  { href: "/#encomendas", label: "Encomendas" },
  { href: "/#vitrine", label: "Vitrine" },
  { href: "/#lojas", label: "Lojas" },
  { href: "/#cakelovers", label: "Cakelovers" },
];

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const stores = await listStores();

  return (
    <>
      <header className="ck-nav">
        <div className="ck-wrap">
          <Link className="ck-brand" href="/" aria-label="Cake 67, início">
            <span className="ck-mark" />
            <span className="ck-word" />
          </Link>
          <nav className="ck-links" aria-label="Seções">
            {SECTIONS.map((section) => (
              <a key={section.href} href={section.href}>
                {section.label}
              </a>
            ))}
          </nav>
          <CartButton />
        </div>
      </header>

      <main id="top">{children}</main>

      <footer className="ck-footer">
        <div className="ck-wrap">
          <div className="ck-logo">
            <span className="ck-mark" />
            <span className="ck-word" />
            <p style={{ fontSize: ".88rem", opacity: 0.85, maxWidth: "30ch" }}>Doceria em Campo Grande/MS. Instagram @cake67cg</p>
          </div>
          <div>
            <h4>Navegue</h4>
            <nav aria-label="Rodapé">
              {SECTIONS.map((section) => (
                <a key={section.href} href={section.href}>
                  {section.label}
                </a>
              ))}
            </nav>
          </div>
          <div>
            <h4>Lojas</h4>
            <nav aria-label="Endereços das lojas">
              {stores.map((store) => (
                <span key={store.id}>{store.address}</span>
              ))}
            </nav>
          </div>
          <div className="ck-legal">
            <span>© {new Date().getFullYear()} Cake 67 Confeitaria e Doceria</span>
            <Link href="/privacidade">Política de privacidade</Link>
          </div>
        </div>
      </footer>

      <Toast />
    </>
  );
}
