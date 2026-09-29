"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProduct } from "@/app/admin/(panel)/produtos/actions";

// Deletes a product that never appeared in an order; back to the list on
// success, the reason otherwise.
export function DeleteProductButton({ productId, productName }: { productId: string; productName: string }) {
  const [pending, startDelete] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function onDelete() {
    if (!window.confirm(`Excluir "${productName}"? Fotos e estoque dele também são apagados. Não dá para desfazer.`)) return;
    setMessage(null);
    startDelete(async () => {
      const result = await deleteProduct(productId);
      if (result.ok) router.push("/admin/produtos?excluido=1");
      else setMessage(result.message ?? "Não foi possível excluir. Tente de novo.");
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border border-raspberry/30 bg-white p-4">
      <h2 className="text-lg text-raspberry">Excluir produto</h2>
      <p className="text-sm text-cocoa-soft">
        Só para cadastro errado ou repetido. Produto que já teve pedido não pode ser excluído: desmarque &quot;Mostrar no
        site&quot;.
      </p>
      <button type="button" onClick={onDelete} disabled={pending} className="btn btn-danger">
        {pending ? "Excluindo…" : "Excluir produto"}
      </button>
      {message && (
        <p role="alert" className="text-sm text-raspberry">
          {message}
        </p>
      )}
    </div>
  );
}
