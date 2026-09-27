"use client";

import { useState } from "react";
import type { StockGroup, StockItem } from "@/lib/stock-grid";
import { StockRow } from "./stock-row";

type Props = {
  storeId: string;
  groups: StockGroup[];
  hidden: StockItem[];
  historyBase: string;
};

function matches(item: StockItem, search: string) {
  return item.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
}

export function StockBoard({ storeId, groups, hidden, historyBase }: Props) {
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
              <StockRow
                key={item.productId}
                productId={item.productId}
                storeId={storeId}
                name={item.name}
                quantity={item.quantity}
                historyHref={history(item.productId)}
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
              <StockRow
                key={item.productId}
                productId={item.productId}
                storeId={storeId}
                name={item.name}
                note={`Fora do site: ${item.hiddenReason}`}
                quantity={item.quantity}
                historyHref={history(item.productId)}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
