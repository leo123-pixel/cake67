import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("settings")
    .select("reservation_minutes, order_whatsapp_template, confirmation_whatsapp_template, privacy_text, privacy_reviewed")
    .eq("id", 1)
    .single();
  if (error) throw new Error(`Could not load settings: ${error.message}`);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl text-olive">Configurações</h1>
      <SettingsForm settings={data} />
    </section>
  );
}
