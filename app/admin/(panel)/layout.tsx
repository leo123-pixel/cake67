import { AdminShell, type NavItem } from "@/components/admin/admin-shell";
import { requireStaff } from "@/lib/auth";

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Início" },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/adicionais", label: "Adicionais" },
  { href: "/admin/lojas", label: "Lojas" },
  { href: "/admin/destaques", label: "Destaques" },
  { href: "/admin/usuarios", label: "Usuários" },
];

const ATTENDANT_ITEMS: NavItem[] = [{ href: "/admin", label: "Início" }];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { supabase, staff } = await requireStaff();

  let subtitle = "Administrador";
  if (staff.role === "atendente") {
    const { data } = await supabase.from("stores").select("name").eq("id", staff.storeId ?? "").maybeSingle();
    subtitle = `Atendente · ${data?.name ?? "loja"}`;
  }

  return (
    <AdminShell
      items={staff.role === "admin" ? ADMIN_ITEMS : ATTENDANT_ITEMS}
      userName={staff.name}
      subtitle={subtitle}
    >
      {children}
    </AdminShell>
  );
}
