import type { Metadata } from "next";
import { CartView } from "@/components/site/cart-view";
import { listCheckoutStores } from "@/lib/storefront";

export const metadata: Metadata = { title: "Seu pedido", robots: { index: false } };

export default async function CartPage() {
  const stores = await listCheckoutStores();

  return (
    <div className="bg-linen text-cocoa">
      <section className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-8">
        <h1 className="text-4xl text-olive">Seu pedido</h1>
        <CartView stores={stores} />
      </section>
    </div>
  );
}
