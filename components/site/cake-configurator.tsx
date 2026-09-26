"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { suggestCake } from "@/lib/cake";
import { formatBRL } from "@/lib/money";
import type { MadeToOrderProduct } from "@/lib/storefront";
import { useCart } from "./use-cart";

const MAX_MESSAGE = 60;

function kgLabel(weight: number) {
  return `${String(weight).replace(".", ",")} kg`;
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="min-h-11 rounded-full border border-cocoa/20 px-4 text-sm text-cocoa transition hover:border-olive aria-pressed:border-olive aria-pressed:bg-olive aria-pressed:text-linen"
    >
      {children}
    </button>
  );
}

// Cake builder with the guest calculator (SPEC §7). The price shown is an
// estimate with the catalog prices; the database recomputes it on the order.
export function CakeConfigurator({ cakes }: { cakes: MadeToOrderProduct[] }) {
  const { add } = useCart();
  const [cakeId, setCakeId] = useState(cakes[0].id);
  const cake = cakes.find((c) => c.id === cakeId) ?? cakes[0];
  const [weight, setWeight] = useState(cake.weightsKg[0]);
  const [format, setFormat] = useState(cake.formats[0]);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [guests, setGuests] = useState(20);
  const [added, setAdded] = useState(false);

  const suggestion = suggestCake(guests, cake.weightsKg, cake.formats);
  const addons = cake.addons.filter((a) => addonIds.includes(a.id));
  const price = Math.round(cake.priceCents * weight) + addons.reduce((sum, a) => sum + a.priceCents, 0);

  function chooseCake(id: string) {
    const next = cakes.find((c) => c.id === id)!;
    setCakeId(id);
    if (!next.weightsKg.includes(weight)) setWeight(next.weightsKg[0]);
    if (!next.formats.includes(format)) setFormat(next.formats[0]);
    setAddonIds((ids) => ids.filter((addonId) => next.addons.some((a) => a.id === addonId)));
    setAdded(false);
  }

  function toggleAddon(id: string) {
    setAddonIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    setAdded(false);
  }

  function addToCart() {
    const label = [kgLabel(weight), format, ...addons.map((a) => a.name)].join(" · ");
    add({
      productId: cake.id,
      type: "bolo_kg",
      name: cake.name,
      imageUrl: cake.imageUrl,
      qty: 1,
      label: message.trim() ? `${label} · frase "${message.trim()}"` : label,
      options: {
        weight_kg: String(weight),
        format,
        addon_ids: addonIds.length ? addonIds : undefined,
        message: message.trim() || undefined,
      },
    });
    setAdded(true);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="mb-2 font-medium">Sabor</legend>
          <div className="flex flex-wrap gap-2">
            {cakes.map((c) => (
              <Chip key={c.id} pressed={c.id === cake.id} onClick={() => chooseCake(c.id)}>
                {c.name.replace(/^Bolo /, "")} <span className="opacity-70">{formatBRL(c.priceCents)}/kg</span>
              </Chip>
            ))}
          </div>
        </fieldset>

        <div className="space-y-3 rounded-2xl bg-peach-light p-4">
          <label htmlFor="guests" className="font-medium">
            Quantas pessoas? <span className="tabular-nums">{guests}</span>
          </label>
          <input
            id="guests"
            type="range"
            min={5}
            max={120}
            step={1}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="w-full accent-olive"
          />
          {suggestion && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p>
                Sugestão: <strong>{kgLabel(suggestion.weightKg)}</strong>, {suggestion.format} · cerca de {suggestion.slices} fatias
              </p>
              <button
                type="button"
                onClick={() => {
                  setWeight(suggestion.weightKg);
                  if (suggestion.format) setFormat(suggestion.format);
                  setAdded(false);
                }}
                className="min-h-11 rounded-full border border-olive px-4 text-olive"
              >
                Usar sugestão
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium">
            Peso
            <select
              value={String(weight)}
              onChange={(e) => {
                setWeight(Number(e.target.value));
                setAdded(false);
              }}
              className="field-input"
            >
              {cake.weightsKg.map((w) => (
                <option key={w} value={String(w)}>
                  {kgLabel(w)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            Formato
            <select
              value={format}
              onChange={(e) => {
                setFormat(e.target.value);
                setAdded(false);
              }}
              className="field-input"
            >
              {cake.formats.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        </div>

        {cake.addons.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">Adicionais</legend>
            <div className="flex flex-wrap gap-2">
              {cake.addons.map((addon) => (
                <Chip key={addon.id} pressed={addonIds.includes(addon.id)} onClick={() => toggleAddon(addon.id)}>
                  {addon.name} <span className="opacity-70">+{formatBRL(addon.priceCents)}</span>
                </Chip>
              ))}
            </div>
          </fieldset>
        )}

        <label className="block space-y-1.5 text-sm font-medium">
          Frase no bolo (opcional)
          <input
            value={message}
            maxLength={MAX_MESSAGE}
            onChange={(e) => {
              setMessage(e.target.value);
              setAdded(false);
            }}
            placeholder="Parabéns, Ana"
            className="field-input"
          />
          <span className="block text-right text-xs text-cocoa-soft">
            {message.length}/{MAX_MESSAGE}
          </span>
        </label>
      </div>

      <aside className="h-fit space-y-4 rounded-3xl bg-olive p-6 text-linen lg:sticky lg:top-24">
        <Image
          src={cake.imageUrl}
          alt={cake.name}
          width={320}
          height={220}
          unoptimized={cake.imageUrl.endsWith(".svg")}
          className="mx-auto h-44 w-auto object-contain"
        />
        <div>
          <p className="font-display text-2xl text-peach-light">{cake.name}</p>
          <p className="text-sm text-linen/80">
            {kgLabel(weight)} · {format}
            {addons.length ? ` · ${addons.map((a) => a.name).join(", ")}` : ""}
          </p>
        </div>
        <p className="text-3xl tabular-nums text-peach">{formatBRL(price)}</p>
        <p className="text-xs text-linen/70">Encomende com pelo menos {cake.leadTimeHours} h de antecedência.</p>
        <button type="button" onClick={addToCart} className="btn w-full bg-peach text-cocoa hover:bg-peach-light">
          Adicionar ao pedido
        </button>
        {added && (
          <p role="status" className="text-center text-sm">
            Bolo no pedido.{" "}
            <Link href="/carrinho" className="underline">
              Ver carrinho
            </Link>
          </p>
        )}
      </aside>
    </div>
  );
}
