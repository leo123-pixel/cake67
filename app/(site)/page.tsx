import { HomeHighlights } from "@/components/site/home-highlights";
import { Assistant } from "@/components/site/home/assistant";
import { CakesShowcase } from "@/components/site/home/cakes-showcase";
import { Hero, Intro, Marquee } from "@/components/site/home/hero";
import { HomeBuilder } from "@/components/site/home/home-builder";
import { HomeVitrine } from "@/components/site/home/home-vitrine";
import { Cakelovers, StoresSection } from "@/components/site/home/stores-section";
import { JsonLd } from "@/components/site/json-ld";
import type { AssistantData } from "@/lib/assistant";
import { listHomeHighlights, listStores, listVitrineMenu } from "@/lib/catalog";
import { todayInCampoGrande } from "@/lib/datetime";
import { siteUrl } from "@/lib/env";
import { describeHours } from "@/lib/store-hours";
import { listCakeShowcase, listMadeToOrder } from "@/lib/storefront";
import { bakeryJsonLd } from "@/lib/structured-data";

// The approved prototype home (prototipo/index.html) on real data (AD-012).
export default async function HomePage() {
  const [stores, highlights, showcase, madeToOrder] = await Promise.all([
    listStores(),
    listHomeHighlights(),
    listCakeShowcase(),
    listMadeToOrder(),
  ]);
  const menus = Object.fromEntries(
    await Promise.all(stores.map(async (store) => [store.slug, await listVitrineMenu(store.id)] as const)),
  );

  const cakes = showcase.filter((cake) => cake.weightsKg.length > 0 && cake.formats.length > 0);
  // The cake of the month shows up as a tag on the cakes; other highlights keep their cards.
  const otherHighlights = highlights.filter((h) => !(h.slot === "bolo_do_mes" && h.productId));
  const firstWhatsapp = stores[0]?.whatsapp ?? null;

  const assistantData: AssistantData = {
    stores: stores.map((store) => ({ name: store.name, address: store.address, hours: describeHours(store.hours) })),
    vitrine: stores.map((store) => ({
      storeName: store.name,
      items: (menus[store.slug] ?? []).flatMap((category) =>
        category.products.map((product) => ({
          name: product.name,
          category: category.name,
          priceCents: product.priceCents,
          available: product.available && product.availableQty > 0,
        })),
      ),
    })),
    cakes: cakes.map((cake) => ({
      name: cake.name,
      priceCents: cake.priceCents,
      leadTimeHours: cake.leadTimeHours,
      weightsKg: cake.weightsKg,
      formats: cake.formats,
    })),
  };

  return (
    <>
      {stores.map((store) => (
        <JsonLd key={store.id} data={bakeryJsonLd(store, siteUrl())} />
      ))}
      <Intro />
      <Hero stores={stores} cakesHref={cakes.length > 0 ? "#encomendas" : "/encomendas"} />
      <Marquee />
      <HomeHighlights highlights={otherHighlights} />
      <CakesShowcase cakes={cakes} />
      {cakes.length > 0 && (
        <HomeBuilder
          cakes={cakes}
          stores={stores.map(({ id, slug, name, address, whatsapp }) => ({ id, slug, name, address, whatsapp }))}
          today={todayInCampoGrande()}
          hasBulk={madeToOrder.some((product) => product.type !== "bolo_kg")}
        />
      )}
      <HomeVitrine stores={stores.map(({ slug, address }) => ({ slug, address }))} menus={menus} />
      <StoresSection stores={stores} />
      <Cakelovers whatsapp={firstWhatsapp} />
      <Assistant data={assistantData} whatsapp={firstWhatsapp} />
    </>
  );
}
