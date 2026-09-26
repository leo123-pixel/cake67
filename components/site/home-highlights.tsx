import Image from "next/image";
import Link from "next/link";
import type { HomeHighlight } from "@/lib/catalog";

const SLOT_EYEBROW = {
  bolo_do_mes: "Bolo do Mês",
  combo_semana: "Combo da Semana",
  banner: "Novidade",
} as const;

function Cta({ highlight }: { highlight: HomeHighlight }) {
  if (!highlight.ctaLabel || !highlight.ctaHref) return null;
  const className =
    "mt-5 inline-flex rounded-full bg-olive px-6 py-3 text-xs font-semibold tracking-[0.14em] text-linen uppercase";
  return highlight.ctaHref.startsWith("/") ? (
    <Link href={highlight.ctaHref} className={className}>
      {highlight.ctaLabel}
    </Link>
  ) : (
    <a href={highlight.ctaHref} target="_blank" rel="noopener noreferrer" className={className}>
      {highlight.ctaLabel}
    </a>
  );
}

export function HomeHighlights({ highlights }: { highlights: HomeHighlight[] }) {
  if (highlights.length === 0) return null;

  return (
    <section aria-label="Destaques" className="bg-peach-light text-cocoa">
      <div className="mx-auto grid max-w-[1320px] gap-4 px-4 py-14 sm:px-8 md:grid-cols-2">
        {highlights.map((highlight) => (
          <article
            key={highlight.id}
            className={`grid overflow-hidden rounded-3xl bg-linen sm:grid-cols-[1fr_auto] ${highlight.slot === "banner" ? "md:col-span-2" : ""}`}
          >
            <div className="p-6 sm:p-8">
              <p className="text-xs font-medium tracking-[0.32em] text-raspberry uppercase">
                {SLOT_EYEBROW[highlight.slot]}
              </p>
              <h2 className="mt-3 text-3xl text-olive sm:text-4xl">{highlight.title}</h2>
              {highlight.subtitle && <p className="mt-3 text-cocoa-soft">{highlight.subtitle}</p>}
              <Cta highlight={highlight} />
            </div>
            {highlight.imageUrl && (
              <Image
                src={highlight.imageUrl}
                alt=""
                width={320}
                height={320}
                className="h-56 w-full object-contain p-4 sm:h-full sm:w-64"
              />
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
