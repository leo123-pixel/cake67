import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { NotFoundPanel } from "@/components/site/not-found-panel";

export const metadata: Metadata = { title: "Página não encontrada", robots: { index: false } };

// Unknown routes render outside the site layout, so this one brings the logo.
export default function NotFound() {
  return (
    <main className="min-h-dvh bg-olive">
      <div className="mx-auto max-w-[1320px] px-4 pt-6 sm:px-8">
        <Link href="/" aria-label="Cake 67, início" className="inline-block text-peach">
          <Logo />
        </Link>
      </div>
      <NotFoundPanel />
    </main>
  );
}
