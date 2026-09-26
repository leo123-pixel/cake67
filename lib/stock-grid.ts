// Pure grid assembly for the stock screen (no Supabase here, so it is testable).

export type GridProduct = {
  id: string;
  name: string;
  active: boolean;
  price_pending: boolean;
  store_ids: string[];
  sort: number;
  category: { id: string; name: string; sort: number } | null;
};

export type GridStockRow = { product_id: string; store_id: string; quantity: number };

export type HiddenReason = "inativo" | "preço a definir" | "não vendido nesta loja";

export type StockItem = {
  productId: string;
  name: string;
  quantity: number;
  hiddenReason: HiddenReason | null;
};

export type StockGroup = { categoryId: string; categoryName: string; items: StockItem[] };

export function hiddenReason(product: GridProduct, storeId: string): HiddenReason | null {
  if (!product.active) return "inativo";
  if (product.price_pending) return "preço a definir";
  if (product.store_ids.length > 0 && !product.store_ids.includes(storeId)) return "não vendido nesta loja";
  return null;
}

// Visible items grouped by category in menu order; the rest in `hidden`.
// Products without a stock row count as 0.
export function buildStockGrid(products: GridProduct[], stock: GridStockRow[], storeId: string) {
  const quantities = new Map(
    stock.filter((row) => row.store_id === storeId).map((row) => [row.product_id, row.quantity]),
  );
  const sorted = [...products].sort(
    (a, b) =>
      (a.category?.sort ?? Number.MAX_SAFE_INTEGER) - (b.category?.sort ?? Number.MAX_SAFE_INTEGER) ||
      a.sort - b.sort ||
      a.name.localeCompare(b.name, "pt-BR"),
  );

  const groups: StockGroup[] = [];
  const hidden: StockItem[] = [];

  for (const product of sorted) {
    const item: StockItem = {
      productId: product.id,
      name: product.name,
      quantity: quantities.get(product.id) ?? 0,
      hiddenReason: hiddenReason(product, storeId),
    };
    if (item.hiddenReason) {
      hidden.push(item);
      continue;
    }

    const categoryId = product.category?.id ?? "sem-categoria";
    let group = groups.find((g) => g.categoryId === categoryId);
    if (!group) {
      group = { categoryId, categoryName: product.category?.name ?? "Sem categoria", items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  return { groups, hidden };
}
