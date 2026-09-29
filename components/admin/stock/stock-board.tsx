"use client";

import { useState } from "react";
import { deleteProduct, duplicateProduct, setProductActive } from "@/app/admin/(panel)/produtos/actions";
import type { MenuAction } from "@/components/admin/actions-menu";
import type { StockGroup, StockItem } from "@/lib/stock-grid";
import { PiecesRow } from "./pieces-row";
import { StockRow } from "./stock-row";

type Props = {
  storeId: string;
  groups: StockGroup[];
  hidden: StockItem[];
  historyBase: string;
  isAdmin: boolean;
};

// Product-level actions on the stock screen (admins only).
function productActions(item: StockItem): MenuAction[] {
  const active = item.hiddenReason !== "inativo";
  return [
    { label: "Editar produto", href: `/admin/produtos/${item.productId}` },
    { label: "Duplicar", run: () => duplicateProduct(item.productId) },
    active
      ? { label: "Desativar (tirar do site)", run: () => setProductActive(item.productId, false) }
      : { label: "Ativar (mostrar no site)", run: () => setProductActive(item.productId, true) },
    {
      label: "Excluir produto",
      danger: true,
      confirm: `Excluir "${item.name}"? Fotos e estoque dele também são apagados. Não dá para desfazer.`,
      run: () => deleteProduct(item.productId),
    },
  ];
}

function matches(item: StockItem, search: string) {
  return item.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
}

export function StockBoard({ storeId, groups, hidden, historyBase, isAdmin }: Props) {
  const [search, setSearch] = useState("");
  const term = search.trim();
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => matches(item, term)) }))
    .filter((group) => group.items.length > 0);
  const hiddenItems = hidden.filter((item) => matches(item, term));
  const history = (productId: string) => `${historyBase}&produto=${productId}`;

  return (
    <div className="space-y-6">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar item"
        aria-label="Buscar item"
        className="field-input"
      />

      {visibleGroups.length === 0 && hiddenItems.length === 0 && (
        <p className="text-cocoa-soft">Nenhum item encontrado.</p>
      )}

      {visibleGroups.map((group) => (
        <section key={group.categoryId} className="space-y-2">
          <h2 className="text-xl text-olive">{group.categoryName}</h2>
          <ul className="space-y-2">
            {group.items.map((item) => (
              <Row
                key={item.productId}
                item={item}
                storeId={storeId}
                historyHref={history(item.productId)}
                actions={isAdmin ? productActions(item) : []}
              />
            ))}
          </ul>
        </section>
      ))}

      {hiddenItems.length > 0 && (
        <details className="rounded-2xl border border-cocoa/10 bg-white/60 p-3">
          <summary className="min-h-11 cursor-pointer content-center font-medium">
            Fora do site ({hiddenItems.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {hiddenItems.map((item) => (
              <Row
                key={item.productId}
                item={item}
                storeId={storeId}
                note={`Fora do site: ${item.hiddenReason}`}
                historyHref={history(item.productId)}
                actions={isAdmin ? productActions(item) : []}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

type RowProps = { item: StockItem; storeId: string; note?: string; historyHref: string; actions: MenuAction[] };

// Counted items get +/−; weighed cakes list their pieces.
function Row({ item, storeId, note, historyHref, actions }: RowProps) {
  if (item.pieces) {
    return (
      <PiecesRow
        productId={item.productId}
        storeId={storeId}
        name={item.name}
        note={note}
        priceCents={item.priceCents}
        pieces={item.pieces}
        historyHref={historyHref}
        productActions={actions}
      />
    );
  }
  return (
    <StockRow
      productId={item.productId}
      storeId={storeId}
      name={item.name}
      note={note}
      quantity={item.quantity}
      historyHref={historyHref}
      productActions={actions}
    />
  );
}
