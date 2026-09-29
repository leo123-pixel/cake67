// Pure grid assembly for the stock screen (no Supabase here, so it is testable).

export type GridProduct = {
  id: string;
  name: string;
  type: "vitrine" | "vitrine_kg";
  price_cents: number;
  active: boolean;
  price_pending: boolean;
  store_ids: string[];
  sort: number;
  category: { id: string; name: string; sort: number } | null;
};

export type GridStockRow = { product_id: string; store_id: string; quantity: number };

// Weighed cake in the showcase (stage 10): available or reserved by an order.
export type GridPiece = {
  id: string;
  productId: string;
  storeId: string;
  weightG: number;
  status: "disponivel" | "reservado";
  orderCode: string | null;
  createdAt: string;
};

export type HiddenReason = "inativo" | "preço a definir" | "não vendido nesta loja";

export type StockItem = {
  productId: string;
  name: string;
  quantity: number;
  hiddenReason: HiddenReason | null;
  // null for counted products; the store's pieces for vitrine_kg.
  pieces: GridPiece[] | null;
  priceCents: number;
};

export type StockGroup = { categoryId: string; categoryName: string; items: StockItem[] };

export function hiddenReason(product: GridProduct, storeId: string): HiddenReason | null {
  if (!product.active) return "inativo";
  if (product.price_pending) return "preço a definir";
  if (product.store_ids.length > 0 && !product.store_ids.includes(storeId)) return "não vendido nesta loja";
  return null;
}

function piecesOf(pieces: GridPiece[], productId: string, storeId: string): GridPiece[] {
  return pieces
    .filter((piece) => piece.productId === productId && piece.storeId === storeId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.weightG - b.weightG);
}

// Visible items grouped by category in menu order; the rest in `hidden`.
// Products without a stock row count as 0; weighed cakes count their
// available pieces.
export function buildStockGrid(
  products: GridProduct[],
  stock: GridStockRow[],
  storeId: string,
  pieces: GridPiece[] = [],
) {
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
    const productPieces = product.type === "vitrine_kg" ? piecesOf(pieces, product.id, storeId) : null;
    const item: StockItem = {
      productId: product.id,
      name: product.name,
      quantity: productPieces
        ? productPieces.filter((piece) => piece.status === "disponivel").length
        : (quantities.get(product.id) ?? 0),
      hiddenReason: hiddenReason(product, storeId),
      pieces: productPieces,
      priceCents: product.price_cents,
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
