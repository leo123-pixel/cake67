"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/site-events";

// Horizontal list of cakes: three per view on desktop, swipe on the phone,
// arrows when there is more to see.
export function CakesRail({ children, count }: { children: ReactNode; count: number }) {
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () =>
      setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [count]);

  function move(direction: 1 | -1) {
    const el = rail.current;
    const card = el?.firstElementChild as HTMLElement | null | undefined;
    if (!el || !card) return;
    // One page = the cards that fit whole, so the next card lands at the start.
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const step = card.offsetWidth + gap;
    const perView = Math.max(1, Math.floor((el.clientWidth + gap + 1) / step));
    el.scrollBy({ left: direction * step * perView, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  const scrollable = !(edges.start && edges.end);

  return (
    <div className="ck-rail-wrap">
      {scrollable && (
        <div className="ck-rail-nav">
          <span className="ck-rail-count">{count} sabores</span>
          <button type="button" aria-label="Bolos anteriores" disabled={edges.start} onClick={() => move(-1)}>
            ‹
          </button>
          <button type="button" aria-label="Mais bolos" disabled={edges.end} onClick={() => move(1)}>
            ›
          </button>
        </div>
      )}
      <div ref={rail} className="ck-cakes ck-rail" role="list" aria-label="Bolos sob encomenda">
        {children}
      </div>
    </div>
  );
}
