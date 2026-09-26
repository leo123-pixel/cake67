import type { Metadata } from "next";
import { getReport } from "@/lib/admin/report";
import { requireAdmin } from "@/lib/auth";
import { formatWeekdayDate, todayInCampoGrande } from "@/lib/datetime";
import { formatBRL } from "@/lib/money";
import { fillDays, PERIOD_PRESETS, PRODUCT_TYPE_LABELS, resolvePeriod, type Report } from "@/lib/report";

export const metadata: Metadata = { title: "Relatório" };

type Props = { searchParams: Promise<{ periodo?: string; de?: string; ate?: string; loja?: string }> };

function formatDay(day: string) {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-cocoa/10 bg-white p-4">
      <p className="text-sm text-cocoa-soft">{label}</p>
      <p className="mt-1 text-2xl text-olive">{value}</p>
      {note && <p className="mt-1 text-xs text-cocoa-soft">{note}</p>}
    </div>
  );
}

function Totals({ totals }: { totals: Report["totals"] }) {
  const aside = (item: { count: number; cents: number }) => `${item.count} · ${formatBRL(item.cents)}`;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card label="Pedidos" value={String(totals.orders)} note="Confirmados, em produção, prontos e entregues" />
      <Card label="Faturamento" value={formatBRL(totals.revenue_cents)} />
      <Card label="Ticket médio" value={totals.avg_ticket_cents === null ? "—" : formatBRL(totals.avg_ticket_cents)} />
      <Card label="Cancelados" value={aside(totals.cancelled)} />
      <Card label="Expirados" value={aside(totals.expired)} />
      <Card label="Aguardando confirmação" value={aside(totals.pending)} />
    </div>
  );
}

function ByDay({ days }: { days: Report["by_day"] }) {
  const max = Math.max(...days.map((day) => day.revenue_cents), 1);
  return (
    <section className="space-y-3">
      <h2 className="text-xl text-olive">Por dia</h2>
      <div className="overflow-hidden rounded-2xl border border-cocoa/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-linen text-left text-cocoa-soft">
            <tr>
              <th className="px-4 py-2 font-medium">Dia</th>
              <th className="px-2 py-2 text-right font-medium">Pedidos</th>
              <th className="px-4 py-2 text-right font-medium">Faturamento</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.day} className="border-t border-cocoa/5">
                <td className="px-4 py-2 whitespace-nowrap">{formatWeekdayDate(day.day)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{day.orders}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-2">
                    <span className="hidden h-2 flex-1 rounded-full bg-linen sm:block" aria-hidden>
                      <span className="block h-2 rounded-full bg-moss" style={{ width: `${(day.revenue_cents / max) * 100}%` }} />
                    </span>
                    <span className="w-24 text-right tabular-nums">{formatBRL(day.revenue_cents)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ByStore({ stores }: { stores: Report["by_store"] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl text-olive">Por loja</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {stores.map((store) => (
          <li key={store.store_id} className="rounded-2xl border border-cocoa/10 bg-white p-4 text-sm">
            <p className="font-medium text-olive">{store.name}</p>
            <p className="mt-1">
              {store.orders} pedidos · {formatBRL(store.revenue_cents)} · ticket médio {formatBRL(store.avg_ticket_cents)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopProducts({ products }: { products: Report["top_products"] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl text-olive">Mais vendidos</h2>
      <ol className="divide-y divide-cocoa/5 overflow-hidden rounded-2xl border border-cocoa/10 bg-white text-sm">
        {products.map((product, index) => (
          <li key={product.product_id ?? product.name} className="flex items-baseline gap-3 px-4 py-3">
            <span className="w-5 text-cocoa-soft tabular-nums">{index + 1}</span>
            <span className="flex-1">
              {product.name}
              <span className="block text-xs text-cocoa-soft">{PRODUCT_TYPE_LABELS[product.type]}</span>
            </span>
            <span className="text-right tabular-nums">
              {product.units} un.{product.kg ? ` · ${String(product.kg).replace(".", ",")} kg` : ""}
              <span className="block text-xs text-cocoa-soft">{formatBRL(product.revenue_cents)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default async function ReportPage({ searchParams }: Props) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const period = resolvePeriod(params.periodo, params.de, params.ate, todayInCampoGrande());

  const { data: stores, error } = await supabase.from("stores").select("id, slug, name").order("sort");
  if (error) throw new Error(`Could not load stores: ${error.message}`);
  const store = stores.find((s) => s.slug === params.loja);

  const report = await getReport(supabase, period, store?.id);
  const hasOrders =
    report.totals.orders + report.totals.cancelled.count + report.totals.expired.count + report.totals.pending.count > 0;

  // Exact dates, so the file matches the screen even across midnight.
  const exportQuery = new URLSearchParams({
    periodo: "personalizado",
    de: period.from,
    ate: period.to,
    ...(store ? { loja: store.slug } : {}),
  });

  return (
    <section className="space-y-6">
      <h1 className="text-3xl text-olive">Relatório</h1>

      <form className="grid gap-3 rounded-2xl border border-cocoa/10 bg-white p-4 sm:grid-cols-5">
        <label className="space-y-1 text-sm">
          Período
          <select name="periodo" defaultValue={period.preset} className="field-input">
            {Object.entries(PERIOD_PRESETS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          De
          <input type="date" name="de" defaultValue={period.from} className="field-input" />
        </label>
        <label className="space-y-1 text-sm">
          Até
          <input type="date" name="ate" defaultValue={period.to} className="field-input" />
        </label>
        <label className="space-y-1 text-sm">
          Loja
          <select name="loja" defaultValue={store?.slug ?? ""} className="field-input">
            <option value="">Todas</option>
            {stores.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary self-end">
          Ver
        </button>
      </form>

      <p className="text-sm text-cocoa-soft">
        {formatDay(period.from)}
        {period.to !== period.from && ` a ${formatDay(period.to)}`} · {store?.name ?? "Todas as lojas"} · pela data em que o
        pedido foi feito. As datas &quot;De/até&quot; valem com o período &quot;De/até&quot;.
      </p>
      {period.notice && (
        <p role="status" className="rounded-xl bg-peach-light px-4 py-3 text-sm">
          {period.notice}
        </p>
      )}

      {hasOrders ? (
        <>
          <Totals totals={report.totals} />
          {period.from !== period.to && report.by_day.length > 0 && <ByDay days={fillDays(report.by_day, period.from, period.to)} />}
          {!store && report.by_store.length > 0 && <ByStore stores={report.by_store} />}
          {report.top_products.length > 0 && <TopProducts products={report.top_products} />}
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-cocoa/20 p-8 text-center text-cocoa-soft">
          Nenhum pedido neste período.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <a href={`/admin/relatorio/exportar?tipo=pedidos&${exportQuery}`} className="btn btn-secondary" download>
          Exportar pedidos (CSV)
        </a>
        <a href={`/admin/relatorio/exportar?tipo=itens&${exportQuery}`} className="btn btn-secondary" download>
          Exportar itens (CSV)
        </a>
      </div>
    </section>
  );
}
