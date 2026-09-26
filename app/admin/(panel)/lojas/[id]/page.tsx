import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { listAdminStores } from "@/lib/admin/catalog";
import { requireAdmin } from "@/lib/auth";
import { StoreForm } from "../store-form";

export const metadata: Metadata = { title: "Loja" };

type Props = { params: Promise<{ id: string }> };

// "nova" creates a store; any other segment must be an existing store id.
export default async function StorePage({ params }: Props) {
  const { supabase } = await requireAdmin();
  const { id } = await params;

  let store;
  if (id !== "nova") {
    if (!z.uuid().safeParse(id).success) notFound();
    store = (await listAdminStores(supabase)).find((s) => s.id === id);
    if (!store) notFound();
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <Link href="/admin/lojas" className="text-sm text-olive underline">
          ← Lojas
        </Link>
        <h1 className="text-3xl text-olive">{store?.name ?? "Nova loja"}</h1>
      </header>
      <StoreForm store={store} />
    </section>
  );
}
