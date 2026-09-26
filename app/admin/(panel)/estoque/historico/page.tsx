import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { listMovements } from "@/lib/admin/stock";
import { ALL_STORES, resolveStockStore } from "@/lib/admin/stock-store";
import { requireStaff } from "@/lib/auth";
import { dayEndExclusiveIso, dayStartIso, formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Histórico do estoque" };

const PAGE = 50;
const REASONS = { ajuste: "Ajuste", reserva: "Reserva", devolucao: "Devolução", venda: "Venda" } as const;

type Params = { loja?: string; produto?: string; de?: string; ate?: string; limite?: string };
type Props = { searchParams: Promise<Params> };

function withParams(params: Params, overrides: Partial<Params>) {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams(
    Object.entries(merged).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  return `/admin/estoque/historico?${search}`;
}

export default async function StockHistoryPage({ searchParams }: Props) {
  const { supabase, staff } = await requireStaff();
  const params = await searchParams;
  const { stores, store, all, isAdmin } = await resolveStockStore(supabase, staff, params.loja);

  const productId = z.uuid().safeParse(params.produto).success ? params.produto : undefined;
  const limit = Math.min(Math.max(Number(params.limite) || PAGE, PAGE), 1000);
  const [{ movements, hasMore }, products] = await Promise.all([
    listMovements(
      supabase,
      {
        storeId: all ? undefined : store?.id,
        productId,
        from: dayStartIso(params.de) ?? undefined,
        to: dayEndExclusiveIso(params.ate) ?? undefined,
      },
      limit,
    ),
    supabase.from("products").select("id, name").eq("type", "vitrine").order("name"),
  ]);
  if (products.error) throw new Error(`Could not load products: ${products.error.message}`);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <Link href={`/admin/estoque${store && !all ? `?loja=${store.slug}` : ""}`} className="text-sm text-olive underline">
          ← Estoque
        </Link>
        <h1 className="text-3xl text-olive">Histórico do estoque</h1>
        {!isAdmin && store && <p className="text-sm text-cocoa-soft">{store.name}</p>}
      </header>

      <form className="grid gap-3 rounded-2xl border border-cocoa/10 bg-white p-4 sm:grid-cols-2">
        {isAdmin && (
          <label className="space-y-1 text-sm">
            Loja
            <select name="loja" defaultValue={all ? ALL_STORES : store?.slug} className="field-input">
              {stores.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name}
                </option>
              ))}
              <option value={ALL_STORES}>Todas as lojas</option>
            </select>
          </label>
        )}
        <label className="space-y-1 text-sm">
          Item
          <select name="produto" defaultValue={productId ?? ""} className="field-input">
            <option value="">Todos os itens</option>
            {products.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          De
          <input type="date" name="de" defaultValue={params.de} className="field-input" />
        </label>
        <label className="space-y-1 text-sm">
          Até
          <input type="date" name="ate" defaultValue={params.ate} className="field-input" />
        </label>
        <button type="submit" className="btn btn-secondary sm:col-span-2">
          Filtrar
        </button>
      </form>

      {movements.length === 0 ? (
        <p className="text-cocoa-soft">Nenhum movimento encontrado.</p>
      ) : (
        <ul className="divide-y divide-cocoa/10 overflow-hidden rounded-2xl border border-cocoa/10 bg-white">
          {movements.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{m.product?.name ?? "Produto removido"}</p>
                <p className="text-cocoa-soft">
                  {formatDateTime(m.created_at)}
                  {all && m.store ? ` · ${m.store.name}` : ""} · {REASONS[m.reason]} · {m.actor_name ?? "—"}
                </p>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <p className={m.delta > 0 ? "text-olive" : "text-raspberry"}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </p>
                {m.quantity_after !== null && <p className="text-xs text-cocoa-soft">ficou com {m.quantity_after}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <Link href={withParams(params, { limite: String(limit + PAGE) })} className="btn btn-secondary w-full">
          Carregar mais
        </Link>
      )}
    </section>
  );
}
