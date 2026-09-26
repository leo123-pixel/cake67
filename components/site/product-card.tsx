import Image from "next/image";
import type { MenuProduct } from "@/lib/catalog";
import { formatBRL } from "@/lib/money";

export function ProductCard({ product }: { product: MenuProduct }) {
  return (
    <article
      className={`grid grid-cols-[88px_1fr] items-center gap-4 bg-olive p-5 sm:grid-cols-[110px_1fr] sm:p-6 ${
        product.available ? "" : "opacity-50"
      }`}
    >
      <div className="grid size-[88px] place-items-center sm:size-[110px]">
        <Image
          src={product.imageUrl}
          alt={product.imageAlt}
          width={110}
          height={110}
          unoptimized={product.imageUrl.endsWith(".svg")}
          className="max-h-full w-auto object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.25)]"
        />
      </div>
      <div>
        <h3 className="text-lg tracking-wide text-linen">{product.name}</h3>
        {product.description && (
          <p className="mt-1 text-xs leading-snug text-linen/70">{product.description}</p>
        )}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="font-medium tabular-nums text-peach">
            {formatBRL(product.priceCents)}
          </span>
          {!product.available && (
            <span className="rounded-full border border-peach/60 px-3 py-1 text-[0.68rem] font-semibold tracking-[0.12em] text-peach uppercase">
              Esgotado
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
