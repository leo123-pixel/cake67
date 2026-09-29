"use client";

import Image from "next/image";
import { useState } from "react";
import { MAX_VITRINE_QTY } from "@/lib/cart/cart";
import type { MenuCategory, MenuProduct } from "@/lib/catalog";
import { formatBRL } from "@/lib/money";
import { flyToCart, showToast } from "@/lib/site-events";
import { useCart } from "../use-cart";

export type VitrineStore = { slug: string; address: string };

function hint(category: string) {
  if (/croissant/i.test(category)) return "Croissants montados na hora, de 12 a 15 minutos.";
  if (/fatia/i.test(category)) return "Fatias de bolo com 4 sabores por semana.";
  return "Consulte a disponibilidade em cada loja.";
}

function Item({ product, storeSlug }: { product: MenuProduct; storeSlug: string }) {
  const { cart, add } = useCart();
  const inCart = cart.storeSlug === storeSlug ? (cart.lines.find((l) => l.key === product.id)?.qty ?? 0) : 0;
  const limit = Math.min(product.availableQty, MAX_VITRINE_QTY);
  const out = !product.available || product.availableQty <= 0;
  const full = inCart >= limit;

  function onAdd(event: React.MouseEvent<HTMLButtonElement>) {
    add({ productId: product.id, type: "vitrine", name: product.name, imageUrl: product.imageUrl, qty: 1 }, storeSlug);
    flyToCart(event.currentTarget.closest(".ck-item")?.querySelector("img") ?? null, product.imageUrl);
    showToast(`${product.name} entrou no pedido`);
  }

  return (
    <article className={`ck-item${out ? " ck-out" : ""}`}>
      <div className="ck-ph">
        <Image
          src={product.imageUrl}
          alt={product.imageAlt}
          width={110}
          height={110}
          unoptimized={product.imageUrl.endsWith(".svg")}
        />
      </div>
      <div>
        <h3>{product.name}</h3>
        {product.description && <p>{product.description}</p>}
        <div className="ck-meta">
          <span className="ck-price">{out ? "Esgotado" : formatBRL(product.priceCents)}</span>
          {out ? (
            <button type="button" className="ck-add" disabled aria-disabled="true">
              Hoje não
            </button>
          ) : (
            <button type="button" className="ck-add" disabled={full} onClick={onAdd}>
              {inCart > 0 ? (full ? `${inCart} no pedido` : `Adicionar (${inCart})`) : "Adicionar"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// Store picker + category tabs over the real menus of every store.
// No store is preselected: the customer must pick one (or have picked one before) to order.
export function HomeVitrine({ stores, menus }: { stores: VitrineStore[]; menus: Record<string, MenuCategory[]> }) {
  const { cart } = useCart();
  const [picked, setPicked] = useState<string | null>(null);
  const remembered = stores.some((s) => s.slug === cart.storeSlug) ? cart.storeSlug : null;
  const storeSlug = picked ?? remembered ?? "";
  const categories = menus[storeSlug] ?? [];
  const [tab, setTab] = useState("");
  const current = categories.find((c) => c.name === tab) ?? categories[0];

  return (
    <section className="ck-sec ck-vit" id="vitrine">
      <div className="ck-wrap">
        <div className="ck-head">
          <div>
            <p className="ck-eyebrow">Pronta entrega</p>
            <h2 className="ck-h">Na vitrine hoje</h2>
          </div>
          {stores.length > 0 && (
            <div className={`ck-storepick${storeSlug ? "" : " ck-storepick-need"}`}>
              <label htmlFor="ck-vstore">Escolha a loja</label>
              <select
                id="ck-vstore"
                value={storeSlug}
                required
                aria-describedby={storeSlug ? undefined : "ck-vstore-hint"}
                onChange={(e) => setPicked(e.target.value)}
              >
                <option value="" disabled>
                  Selecione a loja…
                </option>
                {stores.map((store) => (
                  <option key={store.slug} value={store.slug}>
                    {store.address}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {stores.length > 0 && !storeSlug ? (
          <div className="ck-pickfirst" id="ck-vstore-hint" role="note">
            <strong>Primeiro, escolha a loja.</strong>
            <p>
              Cada loja tem a sua vitrine. Selecione acima a loja onde você vai retirar para ver os produtos
              disponíveis hoje e fazer o pedido.
            </p>
          </div>
        ) : current ? (
          <>
            <div className="ck-tabs" role="tablist" aria-label="Categorias">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={category.id === current.id}
                  onClick={() => setTab(category.name)}
                >
                  {category.name}
                </button>
              ))}
            </div>
            <div className="ck-items" role="tabpanel">
              {current.products.map((product) => (
                <Item key={product.id} product={product} storeSlug={storeSlug} />
              ))}
            </div>
            <div className="ck-vnote">
              <p className="ck-note">{hint(current.name)}</p>
              <p className="ck-note">Preços do cardápio vitrine da Cake 67</p>
            </div>
          </>
        ) : (
          <p className="ck-empty-v">Nenhum produto na vitrine desta loja no momento.</p>
        )}
      </div>
    </section>
  );
}
