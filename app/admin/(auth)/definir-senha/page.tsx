import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Definir senha" };

// Reached through /auth/confirm, which already opened a session from the link.
export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login?erro=link");

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-3xl text-olive">Defina sua senha</h1>
        <p className="text-sm text-cocoa-soft">{user.email}</p>
      </div>
      <PasswordForm email={user.email ?? ""} />
    </>
  );
}
