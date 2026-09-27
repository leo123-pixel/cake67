import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl text-olive">Você não tem permissão para esta área</h1>
      <p className="text-cocoa-soft">Fale com um administrador se precisar de acesso.</p>
      <Link href="/admin" className="btn btn-secondary">
        Voltar ao início
      </Link>
    </section>
  );
}
