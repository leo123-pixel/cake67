import type { Metadata } from "next";
import { listAdminStores } from "@/lib/admin/catalog";
import { listTeam } from "@/lib/admin/staff";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamManager } from "./team-manager";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage() {
  // Service role only after the admin check.
  const { supabase, staff } = await requireAdmin();
  const [members, stores] = await Promise.all([
    listTeam(supabase, createAdminClient()),
    listAdminStores(supabase),
  ]);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl text-olive">Usuários</h1>
        <p className="text-sm text-cocoa-soft">
          Convites e novas senhas saem como link. Envie pelo WhatsApp só para a pessoa.
        </p>
      </header>
      <TeamManager
        members={members}
        stores={stores.map(({ id, name }) => ({ id, name }))}
        currentUserId={staff.userId}
      />
    </section>
  );
}
