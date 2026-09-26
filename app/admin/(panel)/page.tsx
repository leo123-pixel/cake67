import Link from "next/link";
import { OrderList } from "@/components/admin/orders/order-row";
import { StatusBadge } from "@/components/admin/status-badge";
import { getDashboard } from "@/lib/admin/orders";
import { requireStaff } from "@/lib/auth";
import { todayInCampoGrande } from "@/lib/datetime";
import { STATUS_LABELS, STATUS_TONES, type OrderStatus } from "@/lib/order-status";

const ADMIN_SHORTCUTS = [
  { href: "/admin/estoque", title: "Estoque", text: "Quantidades da vitrine por loja e contagem" },
  { href: "/admin/produtos/novo", title: "Novo produto", text: "Cadastre bebidas e itens novos" },
  { href: "/admin/produtos", title: "Produtos", text: "Preços, fotos e disponibilidade no site" },
  { href: "/admin/destaques", title: "Destaques", text: "Bolo do Mês, Combo da Semana e banners" },
  { href: "/admin/lojas", title: "Lojas", text: "Endereço, WhatsApp e horários" },
  { href: "/admin/usuarios", title: "Usuários", text: "Convide atendentes e gere links de senha" },
];

const ATTENDANT_SHORTCUTS = [
  { href: "/admin/estoque/contagem", title: "Contagem da vitrine", text: "Lance quanto tem de cada item ao abrir a loja" },
  { href: "/admin/estoque", title: "Estoque", text: "Somar, tirar e esgotar itens ao longo do dia" },
];

const COUNT_ORDER: OrderStatus[] = ["novo", "confirmado", "em_producao", "pronto", "entregue", "cancelado", "expirado"];

type Props = { searchParams: Promise<{ loja?: string }> };

export default async function PanelHome({ searchParams }: Props) {
  const { supabase, staff } = await requireStaff();
  const isAdmin = staff.role === "admin";
  const { loja } = await searchParams;

  const { data: stores } = await supabase.from("stores").select("id, slug, name").order("sort");
  const store = isAdmin ? stores?.find((s) => s.slug === loja) : undefined;
  const { pending, counts, outToday } = await getDashboard(supabase, todayInCampoGrande(), store?.id);
  const shortcuts = isAdmin ? ADMIN_SHORTCUTS : ATTENDANT_SHORTCUTS;

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl text-olive">Olá, {staff.name}</h1>
        {isAdmin && stores && (
          <form className="flex items-center gap-2 text-sm">
            <select name="loja" defaultValue={store?.slug ?? ""} aria-label="Loja" className="field-input w-auto">
              <option value="">Todas as lojas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary">
              Ver
            </button>
          </form>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="text-xl text-olive">A confirmar ({pending.length})</h2>
        <OrderList orders={pending} showStore={isAdmin} empty="Nenhum pedido esperando confirmação." />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl text-olive">Feitos hoje</h2>
        <div className="flex flex-wrap gap-2">
          {COUNT_ORDER.map((status) => (
            <Link key={status} href={`/admin/pedidos?status=${status}${store ? `&loja=${store.slug}` : ""}`}>
              <StatusBadge tone={STATUS_TONES[status]}>
                {STATUS_LABELS[status]}: {counts.get(status) ?? 0}
              </StatusBadge>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl text-olive">Saem hoje ({outToday.length})</h2>
        <OrderList orders={outToday} showStore={isAdmin} empty="Nenhuma encomenda marcada para hoje." />
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {shortcuts.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block rounded-2xl border border-cocoa/10 bg-white p-5 transition hover:border-olive">
              <span className="block font-medium text-olive">{item.title}</span>
              <span className="mt-1 block text-sm text-cocoa-soft">{item.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
