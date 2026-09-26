import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  inativo: "Seu acesso ao painel não está ativo.",
  link: "Link inválido ou expirado. Peça um novo a um administrador.",
};

type Props = { searchParams: Promise<{ erro?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { erro } = await searchParams;

  return (
    <>
      <h1 className="text-3xl text-olive">Painel Cake 67</h1>
      <LoginForm notice={erro ? NOTICES[erro] : undefined} />
    </>
  );
}
