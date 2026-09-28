"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { suggestCake } from "@/lib/cake";
import { cakeWhatsappMessage, minCakeDate } from "@/lib/cake-order";
import { formatBRL } from "@/lib/money";
import { flyToCart, PICK_CAKE_EVENT, prefersReducedMotion, scrollToId, showToast } from "@/lib/site-events";
import type { ShowcaseCake } from "@/lib/storefront";
import { whatsappLink } from "@/lib/whatsapp";
import { useCart } from "../use-cart";

// whatsapp: the made-to-order number, for cakes still without a price (spec 08, D3).
export type BuilderStore = { id: string; slug: string; name: string; address: string; whatsapp: string };

const DELIVERY = "entrega";

function kgLabel(weight: number) {
  return `${String(weight).replace(".", ",")} kg`;
}

function shortStore(store: BuilderStore) {
  return `${store.name} · ${store.address.split(",")[0]}`;
}

// The total counts up to the new value, like the prototype.
function useTween(target: number) {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = target;
      setShown(target);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 400);
      const value = from + (target - from) * (1 - Math.pow(1 - k, 3));
      current.current = value;
      setShown(value);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return Math.round(shown);
}

type Props = { cakes: ShowcaseCake[]; stores: BuilderStore[]; today: string; hasBulk: boolean };

export function HomeBuilder({ cakes, stores, today, hasBulk }: Props) {
  const { add, setPreferred } = useCart();
  const [cakeId, setCakeId] = useState(cakes[0].id);
  const cake = cakes.find((c) => c.id === cakeId) ?? cakes[0];
  const [guests, setGuests] = useState(24);
  const [weight, setWeight] = useState(cake.weightsKg.includes(2) ? 2 : cake.weightsKg[0]);
  const [format, setFormat] = useState(cake.formats[0] ?? "");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const cakeStores = stores.filter((s) => cake.storeIds.length === 0 || cake.storeIds.includes(s.id));
  const [chosenPlace, setPlace] = useState(stores[0]?.slug ?? DELIVERY);
  // A store that does not sell the newly picked cake falls back to the first one that does.
  const place =
    chosenPlace === DELIVERY || cakeStores.some((s) => s.slug === chosenPlace) ? chosenPlace : (cakeStores[0]?.slug ?? DELIVERY);
  const minDate = minCakeDate(today, cake.leadTimeHours);
  const [date, setDate] = useState(minDate);
  const addButton = useRef<HTMLButtonElement>(null);

  const suggestion = suggestCake(guests, cake.weightsKg, cake.formats);
  const addons = cake.addons.filter((a) => addonIds.includes(a.id));
  const price =
    cake.priceCents === null ? null : Math.round(cake.priceCents * weight) + addons.reduce((sum, a) => sum + a.priceCents, 0);
  const shownPrice = useTween(price ?? 0);
  const pickupDate = date < minDate ? minDate : date;
  const store = cakeStores.find((s) => s.slug === place);

  function chooseCake(id: string) {
    const next = cakes.find((c) => c.id === id);
    if (!next) return;
    setCakeId(id);
    if (!next.weightsKg.includes(weight)) setWeight(next.weightsKg.includes(2) ? 2 : next.weightsKg[0]);
    if (!next.formats.includes(format)) setFormat(next.formats[0] ?? "");
    setAddonIds((ids) => ids.filter((addonId) => next.addons.some((a) => a.id === addonId)));
  }

  // "Montar este" in the showcase selects the cake here.
  useEffect(() => {
    const onPick = (event: Event) => chooseCake((event as CustomEvent<string>).detail);
    window.addEventListener(PICK_CAKE_EVENT, onPick);
    return () => window.removeEventListener(PICK_CAKE_EVENT, onPick);
  });

  function applySuggestion() {
    if (!suggestion) return;
    setWeight(suggestion.weightKg);
    if (suggestion.format) setFormat(suggestion.format);
    scrollToId("ck-cfg", "center");
    showToast("Peso e formato preenchidos");
  }

  function addToCart() {
    const label = [kgLabel(weight), format, ...addons.map((a) => a.name)].join(" · ");
    add(
      {
        productId: cake.id,
        type: "bolo_kg",
        name: cake.name,
        imageUrl: cake.imageUrl,
        qty: 1,
        label,
        options: { weight_kg: String(weight), format, addon_ids: addonIds.length ? addonIds : undefined },
      },
      store?.slug,
    );
    setPreferred({ fulfillment: place === DELIVERY ? "entrega" : "retirada", day: pickupDate });
    flyToCart(addButton.current, cake.imageUrl);
    showToast(`${cake.name} entrou no pedido`);
  }

  const whatsappStore = store ?? stores[0];
  const whatsappHref = whatsappStore
    ? whatsappLink(
        whatsappStore.whatsapp,
        cakeWhatsappMessage({
          name: cake.name,
          weightKg: weight,
          format,
          addons: addons.map((a) => a.name),
          fulfillment: store ? `Retirada na ${store.name} · ${store.address}` : "Entrega em casa (taxa a combinar)",
          date: pickupDate,
        }),
      )
    : null;

  return (
    <section className="ck-sec ck-build" id="encomendas">
      <div className="ck-wrap">
        <p className="ck-eyebrow">Encomendas</p>
        <h2 className="ck-h">Quantos convidados? A gente faz a conta.</h2>
        <p className="ck-intro-t">
          Diga o tamanho da festa e veja o peso e o formato ideais. Depois escolha o sabor e os adicionais, com o preço
          atualizando na hora.
        </p>
        <div className="ck-grid2">
          <div className="ck-card ck-rv" id="ck-calc" aria-labelledby="ck-calc-t">
            <p className="ck-eyebrow">Passo 1</p>
            <h3 className="ck-h" id="ck-calc-t">
              Calculadora de convidados
            </h3>
            <label className="ck-label" htmlFor="ck-guests">
              Número de convidados
            </label>
            <div className="ck-guests">
              <input id="ck-guests" type="range" min={6} max={120} step={1} value={guests} onChange={(e) => setGuests(Number(e.target.value))} />
              <output htmlFor="ck-guests">{guests}</output>
            </div>
            <div className="ck-result">
              <div>
                <b>{suggestion ? kgLabel(suggestion.weightKg) : "—"}</b>
                <span>peso</span>
              </div>
              <div>
                <b>{suggestion?.format ?? "—"}</b>
                <span>formato</span>
              </div>
              <div>
                <b>{suggestion?.slices ?? "—"}</b>
                <span>fatias</span>
              </div>
            </div>
            <p className="ck-small">Base de cerca de 10 fatias por kg, com folga para repetir. O valor final depende da pesagem.</p>
            <button type="button" className="ck-btn ck-btn-olive" style={{ marginTop: 20 }} onClick={applySuggestion}>
              Usar esta sugestão
            </button>
          </div>

          <div className="ck-card ck-rv" id="ck-cfg" aria-labelledby="ck-cfg-t">
            <p className="ck-eyebrow">Passo 2</p>
            <h3 className="ck-h" id="ck-cfg-t">
              Monte seu bolo
            </h3>
            <span className="ck-label">Sabor</span>
            <div className="ck-chips" role="group" aria-label="Sabor">
              {cakes.map((c) => (
                <button key={c.id} type="button" className="ck-chip" aria-pressed={c.id === cake.id} onClick={() => chooseCake(c.id)}>
                  {c.name.replace(/^Bolo /, "")}
                  <small>{c.priceCents === null ? "preço em breve" : `${formatBRL(c.priceCents)}/kg`}</small>
                </button>
              ))}
            </div>
            <div className="ck-row2">
              <div>
                <label className="ck-label" htmlFor="ck-kg">
                  Peso
                </label>
                <select id="ck-kg" className="ck-field" value={String(weight)} onChange={(e) => setWeight(Number(e.target.value))}>
                  {cake.weightsKg.map((w) => (
                    <option key={w} value={String(w)}>
                      {kgLabel(w)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ck-label" htmlFor="ck-fmt">
                  Formato
                </label>
                <select id="ck-fmt" className="ck-field" value={format} onChange={(e) => setFormat(e.target.value)}>
                  {cake.formats.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>
            {cake.addons.length > 0 && (
              <>
                <span className="ck-label">Adicionais</span>
                <div className="ck-chips" role="group" aria-label="Adicionais">
                  {cake.addons.map((addon) => (
                    <button
                      key={addon.id}
                      type="button"
                      className="ck-chip"
                      aria-pressed={addonIds.includes(addon.id)}
                      onClick={() =>
                        setAddonIds((ids) => (ids.includes(addon.id) ? ids.filter((x) => x !== addon.id) : [...ids, addon.id]))
                      }
                    >
                      {addon.name}
                      <small>+{formatBRL(addon.priceCents)}</small>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="ck-row2">
              <div>
                <label className="ck-label" htmlFor="ck-store">
                  Retirada
                </label>
                <select id="ck-store" className="ck-field" value={place} onChange={(e) => setPlace(e.target.value)}>
                  {cakeStores.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {shortStore(s)}
                    </option>
                  ))}
                  <option value={DELIVERY}>Entrega em casa</option>
                </select>
              </div>
              <div>
                <label className="ck-label" htmlFor="ck-date">
                  Data
                </label>
                <input id="ck-date" type="date" className="ck-field" min={minDate} value={pickupDate} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <p className="ck-small">
              Encomendas com pelo menos {cake.leadTimeHours} h de antecedência. O horário você escolhe ao finalizar o pedido.
            </p>
            <div className="ck-total">
              <div>
                <div className="ck-l">Total estimado</div>
                {price === null ? (
                  <div className="ck-v ck-soon">Preço em breve</div>
                ) : (
                  <div className="ck-v">{formatBRL(shownPrice)}</div>
                )}
              </div>
              {price === null ? (
                whatsappHref && (
                  <a className="ck-btn ck-btn-olive" href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    Pedir pelo WhatsApp
                  </a>
                )
              ) : (
                <button ref={addButton} type="button" className="ck-btn ck-btn-olive" onClick={addToCart}>
                  Adicionar ao pedido
                </button>
              )}
            </div>
          </div>
        </div>
        {hasBulk && (
          <p className="ck-more">
            Também fazemos salgados e doces por cento e kits festa. <Link href="/encomendas">Ver encomendas</Link>
          </p>
        )}
      </div>
    </section>
  );
}
