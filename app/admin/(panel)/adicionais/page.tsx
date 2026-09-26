import type { Metadata } from "next";
import { listAdminAddons } from "@/lib/admin/catalog";
import { requireAdmin } from "@/lib/auth";
import { AddonsManager } from "./addons-manager";

export const metadata: Metadata = { title: "Adicionais" };

export default async function AddonsPage() {
  const { supabase } = await requireAdmin();
  const addons = await listAdminAddons(supabase);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl text-olive">Adicionais de bolo</h1>
        <p className="text-sm text-cocoa-soft">
          Escolha em cada bolo quais adicionais ele aceita. Desativar aqui tira o adicional de todos os bolos.
        </p>
      </header>
      <AddonsManager addons={addons} />
    </section>
  );
}
