import type { Metadata } from "next";
import Link from "next/link";
import { CountForm } from "@/components/admin/stock/count-form";
import { StockStorePicker } from "@/components/admin/stock/stock-store-picker";
import { getStockGrid } from "@/lib/admin/stock";
import { resolveStockStore } from "@/lib/admin/stock-store";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Contagem" };

type Props = { searchParams: Promise<{ loja?: string }> };

export default async function CountPage({ searchParams }: Props) {
  const { supabase, staff } = await requireStaff();
  const { loja } = await searchParams;
  const { stores, store, isAdmin } = await resolveStockStore(supabase, staff, loja);
  if (!store) return <p className="text-cocoa-soft">Nenhuma loja ativa.</p>;

  // Only items on the site are counted; items off the site keep their value.
  const { groups } = await getStockGrid(supabase, store.id);

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <Link href={`/admin/estoque?loja=${store.slug}`} className="text-sm text-olive underline">
          ← Estoque
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl text-olive">Contagem · {store.name}</h1>
          {isAdmin && <StockStorePicker action="/admin/estoque/contagem" stores={stores} current={store.slug} allowAll={false} />}
        </div>
        <p className="text-sm text-cocoa-soft">
          Digite quanto tem de cada item na vitrine agora. Só os itens que mudarem entram no histórico.
        </p>
      </header>
      <CountForm storeId={store.id} storeSlug={store.slug} groups={groups} />
    </section>
  );
}
