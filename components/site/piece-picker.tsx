"use client";

import { useState } from "react";
import type { MenuPiece } from "@/lib/catalog";
import { formatBRL } from "@/lib/money";
import { formatKg } from "@/lib/weight";
import { useCart } from "./use-cart";

type Props = {
  productId: string;
  name: string;
  imageUrl: string;
  pieces: MenuPiece[];
  storeSlug: string;
};

// Weighed whole cake (stage 10): the customer picks one of the cakes on the
// shelf by its weight. Each pick is its own cart line.
export function PiecePicker({ productId, name, imageUrl, pieces, storeSlug }: Props) {
  const { cart, add } = useCart();
  const inCart = new Set(
    cart.storeSlug === storeSlug ? cart.lines.map((line) => line.options?.piece_id).filter(Boolean) : [],
  );
  const choices = pieces.filter((piece) => !inCart.has(piece.id));
  const [picked, setPicked] = useState<string | null>(null);
  const selected = choices.find((piece) => piece.id === picked) ?? (choices.length === 1 ? choices[0] : undefined);

  if (choices.length === 0) {
    return (
      <span className="rounded-full border border-peach/60 px-3 py-1 text-[0.68rem] font-semibold tracking-[0.12em] text-peach uppercase">
        {pieces.length > 0 ? "No pedido" : "Esgotado"}
      </span>
    );
  }

  function addPicked() {
    if (!selected) return;
    add(
      {
        productId,
        type: "vitrine_kg",
        name,
        imageUrl,
        qty: 1,
        label: formatKg(selected.weightG),
        options: { piece_id: selected.id },
      },
      storeSlug,
    );
    setPicked(null);
  }

  return (
    <div className="space-y-2.5">
      <div role="radiogroup" aria-label={`Peso do ${name}`} className="flex flex-wrap gap-2">
        {choices.map((piece) => {
          const checked = piece.id === selected?.id;
          return (
            <button
              key={piece.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setPicked(piece.id)}
              className={`min-h-11 rounded-full border px-3 text-xs tabular-nums transition ${
                checked ? "border-peach bg-peach text-cocoa" : "border-peach/50 text-linen hover:border-peach"
              }`}
            >
              {formatKg(piece.weightG)} · {formatBRL(piece.priceCents)}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={!selected}
        onClick={addPicked}
        className="min-h-11 rounded-full border border-peach px-4 text-[0.68rem] font-semibold tracking-[0.12em] text-peach uppercase transition hover:bg-peach hover:text-cocoa disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-peach"
      >
        {selected ? "Adicionar" : "Escolha o peso"}
      </button>
    </div>
  );
}
