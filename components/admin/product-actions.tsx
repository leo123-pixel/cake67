"use client";

import { deleteProduct, duplicateProduct, setProductActive } from "@/app/admin/(panel)/produtos/actions";
import { ActionsMenu } from "./actions-menu";

type Props = { product: { id: string; name: string; active: boolean } };

// Editar, Duplicar, Ativar/Desativar and Excluir for one product (admin only).
export function ProductActions({ product }: Props) {
  return (
    <ActionsMenu
      label={product.name}
      actions={[
        { label: "Editar", href: `/admin/produtos/${product.id}` },
        { label: "Duplicar", run: () => duplicateProduct(product.id) },
        product.active
          ? { label: "Desativar (tirar do site)", run: () => setProductActive(product.id, false) }
          : { label: "Ativar (mostrar no site)", run: () => setProductActive(product.id, true) },
        {
          label: "Excluir",
          danger: true,
          confirm: `Excluir "${product.name}"? Fotos e estoque dele também são apagados. Não dá para desfazer.`,
          run: () => deleteProduct(product.id),
        },
      ]}
    />
  );
}
