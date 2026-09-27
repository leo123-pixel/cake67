import Link from "next/link";
import { requireStaff } from "@/lib/auth";

const SHORTCUTS = [
  { href: "/admin/produtos/novo", title: "Novo produto", text: "Cadastre bebidas e itens novos" },
  { href: "/admin/produtos", title: "Produtos", text: "Preços, fotos e disponibilidade no site" },
  { href: "/admin/destaques", title: "Destaques", text: "Bolo do Mês, Combo da Semana e banners" },
  { href: "/admin/lojas", title: "Lojas", text: "Endereço, WhatsApp e horários" },
  { href: "/admin/usuarios", title: "Usuários", text: "Convide atendentes e gere links de senha" },
];

export default async function PanelHome() {
  const { staff } = await requireStaff();

  if (staff.role === "atendente") {
    return (
      <section className="space-y-3">
        <h1 className="text-3xl text-olive">Olá, {staff.name}</h1>
        <p className="text-cocoa-soft">Os pedidos da sua loja aparecem aqui quando a etapa de operação entrar no ar.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl text-olive">Olá, {staff.name}</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SHORTCUTS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-2xl border border-cocoa/10 bg-white p-5 transition hover:border-olive"
            >
              <span className="block font-medium text-olive">{item.title}</span>
              <span className="mt-1 block text-sm text-cocoa-soft">{item.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
