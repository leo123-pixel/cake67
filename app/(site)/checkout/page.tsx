import type { Metadata } from "next";
import { CheckoutForm } from "@/components/site/checkout-form";
import { listCheckoutStores } from "@/lib/storefront";

export const metadata: Metadata = { title: "Finalizar pedido", robots: { index: false } };

export default async function CheckoutPage() {
  const stores = await listCheckoutStores();

  return (
    <div className="bg-linen text-cocoa">
      <section className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-8">
        <h1 className="text-4xl text-olive">Finalizar pedido</h1>
        <CheckoutForm stores={stores} />
      </section>
    </div>
  );
}
