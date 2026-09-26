"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/site/logo";

export type NavItem = { href: string; label: string };

type Props = {
  items: NavItem[];
  userName: string;
  subtitle: string;
  children: React.ReactNode;
};

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export function AdminShell({ items, userName, subtitle, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav aria-label="Painel" className="flex flex-col gap-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium hover:bg-olive/10 aria-[current=page]:bg-olive aria-[current=page]:text-linen"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const account = (
    <div className="space-y-3 border-t border-cocoa/10 pt-4 text-sm">
      <div>
        <p className="font-medium">{userName}</p>
        <p className="text-cocoa-soft">{subtitle}</p>
      </div>
      <form action="/auth/sair" method="post">
        <button type="submit" className="btn btn-secondary w-full">
          Sair
        </button>
      </form>
    </div>
  );

  return (
    <div className="md:grid md:min-h-dvh md:grid-cols-[240px_1fr]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-cocoa/10 bg-linen/95 px-4 py-2 backdrop-blur md:hidden">
        <Link href="/admin" className="text-olive" aria-label="Início do painel">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="admin-menu"
          className="btn btn-secondary"
        >
          {open ? "Fechar" : "Menu"}
        </button>
      </header>

      {open && (
        <div id="admin-menu" className="space-y-4 border-b border-cocoa/10 bg-linen px-4 pb-4 md:hidden">
          {nav}
          {account}
        </div>
      )}

      <aside className="sticky top-0 hidden h-dvh flex-col justify-between border-r border-cocoa/10 p-4 md:flex">
        <div className="space-y-6">
          <Link href="/admin" className="block text-olive" aria-label="Início do painel">
            <Logo />
          </Link>
          {nav}
        </div>
        {account}
      </aside>

      <main className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
