import type { Metadata } from "next";
import Link from "next/link";
import { StockBoard } from "@/components/admin/stock/stock-board";
import { StockStorePicker } from "@/components/admin/stock/stock-store-picker";
import { getStockGrid, getStockOverview } from "@/lib/admin/stock";
import { ALL_STORES, resolveStockStore } from "@/lib/admin/stock-store";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Estoque" };

type Props = { searchParams: Promise<{ loja?: string }> };

export default async function StockPage({ searchParams }: Props) {
  const { supabase, staff } = await requireStaff();
  const { loja } = await searchParams;
  const { stores, store, all, isAdmin } = await resolveStockStore(supabase, staff, loja);

  if (!store) {
    return <p className="text-cocoa-soft">Nenhuma loja ativa.</p>;
  }

  const header = (
    <header className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl text-olive">Estoque</h1>
        {isAdmin && (
          <StockStorePicker action="/admin/estoque" stores={stores} current={all ? ALL_STORES : store.slug} allowAll />
        )}
      </div>
      {!all && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/estoque/contagem?loja=${store.slug}`} className="btn btn-primary">
            Contagem
          </Link>
          <Link href={`/admin/estoque/historico?loja=${store.slug}`} className="btn btn-secondary">
            Histórico
          </Link>
          {!isAdmin && <span className="self-center text-sm text-cocoa-soft">{store.name}</span>}
        </div>
      )}
    </header>
  );

  if (all) {
    const overview = await getStockOverview(supabase, stores);
    return (
      <section className="space-y-6">
        {header}
        <p className="text-sm text-cocoa-soft">Só consulta. Toque numa quantidade para ajustar naquela loja.</p>
        <div className="overflow-x-auto rounded-2xl border border-cocoa/10 bg-white">
          <table className="w-full min-w-md text-sm">
            <thead>
              <tr className="border-b border-cocoa/10 text-left">
                <th className="p-3 font-medium">Item</th>
                {stores.map((s) => (
                  <th key={s.id} className="p-3 text-right font-medium">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            {overview.map((group) => (
              <tbody key={group.categoryId}>
                <tr>
                  <th colSpan={stores.length + 1} className="bg-linen p-2 text-left font-display text-base font-normal text-olive">
                    {group.categoryName}
                  </th>
                </tr>
                {group.items.map((item) => (
                  <tr key={item.productId} className="border-t border-cocoa/5">
                    <td className="p-3">{item.name}</td>
                    {item.cells.map((cell) => {
                      const target = stores.find((s) => s.id === cell.storeId)!;
                      return (
                        <td key={cell.storeId} className="p-3 text-right tabular-nums">
                          {cell.sold ? (
                            <Link
                              href={`/admin/estoque?loja=${target.slug}`}
                              className={cell.quantity === 0 ? "font-semibold text-raspberry" : "text-cocoa"}
                            >
                              {cell.quantity === 0 ? "Esgotado" : cell.quantity}
                            </Link>
                          ) : (
                            <span className="text-cocoa-soft">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>
    );
  }

  const { groups, hidden } = await getStockGrid(supabase, store.id);
  return (
    <section className="space-y-6">
      {header}
      <StockBoard
        storeId={store.id}
        groups={groups}
        hidden={isAdmin ? hidden : []}
        historyBase={`/admin/estoque/historico?loja=${store.slug}`}
      />
    </section>
  );
}
