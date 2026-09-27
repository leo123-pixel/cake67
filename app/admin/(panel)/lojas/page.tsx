import type { Metadata } from "next";
import Link from "next/link";
import { listAdminStores } from "@/lib/admin/catalog";
import { requireAdmin } from "@/lib/auth";
import { StoresList } from "./stores-list";

export const metadata: Metadata = { title: "Lojas" };

export default async function StoresPage() {
  const { supabase } = await requireAdmin();
  const stores = await listAdminStores(supabase);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl text-olive">Lojas</h1>
          <p className="text-sm text-cocoa-soft">A ordem aqui é a ordem no site.</p>
        </div>
        <Link href="/admin/lojas/nova" className="btn btn-primary">
          Nova loja
        </Link>
      </header>
      <StoresList stores={stores} />
    </section>
  );
}
