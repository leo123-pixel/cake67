import type { Metadata } from "next";
import { OrderList } from "@/components/admin/orders/order-row";
import { listOrders } from "@/lib/admin/orders";
import { requireStaff } from "@/lib/auth";
import { dayStartIso, todayInCampoGrande } from "@/lib/datetime";
import { STATUS_LABELS, type OrderStatus } from "@/lib/order-status";

export const metadata: Metadata = { title: "Pedidos" };

type Props = { searchParams: Promise<{ status?: string; loja?: string; data?: string }> };

export default async function OrdersPage({ searchParams }: Props) {
  const { supabase, staff } = await requireStaff();
  const params = await searchParams;
  const isAdmin = staff.role === "admin";

  const status = params.status && params.status in STATUS_LABELS ? (params.status as OrderStatus) : undefined;
  const date = dayStartIso(params.data) ? params.data! : todayInCampoGrande();

  const { data: stores, error } = await supabase.from("stores").select("id, slug, name").order("sort");
  if (error) throw new Error(`Could not load stores: ${error.message}`);
  const store = isAdmin ? stores.find((s) => s.slug === params.loja) : undefined;

  const orders = await listOrders(supabase, { status, date, storeId: store?.id });

  return (
    <section className="space-y-6">
      <h1 className="text-3xl text-olive">Pedidos</h1>

      <form className="grid gap-3 rounded-2xl border border-cocoa/10 bg-white p-4 sm:grid-cols-4">
        <label className="space-y-1 text-sm">
          Status
          <select name="status" defaultValue={status ?? ""} className="field-input">
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {isAdmin && (
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
        )}
        <label className="space-y-1 text-sm">
          Feitos em
          <input type="date" name="data" defaultValue={date} className="field-input" />
        </label>
        <button type="submit" className="btn btn-secondary self-end">
          Filtrar
        </button>
      </form>

      <p className="text-sm text-cocoa-soft">Pedidos novos aparecem sempre, qualquer que seja a data.</p>
      <OrderList orders={orders} showStore={isAdmin} empty="Nenhum pedido com esses filtros." />
    </section>
  );
}
