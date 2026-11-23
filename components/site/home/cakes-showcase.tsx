import Image from "next/image";
import type { ShowcaseCake } from "@/lib/storefront";
import { CakesRail } from "./cakes-rail";
import { PickCakeButton } from "./pick-cake-button";

function kgLabel(weight: number) {
  return `${String(weight).replace(".", ",")} kg`;
}

// Every cake (featured first, then the panel order) in a horizontal rail:
// three per view like the prototype, the rest by swiping or the arrows.
export function CakesShowcase({ cakes }: { cakes: ShowcaseCake[] }) {
  if (cakes.length === 0) return null;

  return (
    <section className="ck-sec ck-light" id="bolos">
      <div className="ck-wrap">
        <div className="ck-head">
          <div>
            <p className="ck-eyebrow">Bolos sob encomenda</p>
            <h2 className="ck-h">Recheio generoso, fruta de verdade.</h2>
          </div>
          <p className="ck-doodle ck-note" style={{ color: "var(--color-olive)" }}>
            escolha e monte abaixo
            <svg viewBox="0 0 70 40" aria-hidden="true">
              <path d="M2 6 C 20 0, 30 30, 12 26 C 0 22, 20 4, 40 16 S 60 36, 66 32" />
              <path className="ck-tip" d="M60 28 L66 32 L60 36" />
            </svg>
          </p>
        </div>
        <CakesRail count={cakes.length}>
          {cakes.map((cake, index) => (
            <article key={cake.id} className="ck-cake" role="listitem">
              <div className="ck-ph">
                <Image
                  src={cake.imageUrl}
                  alt={cake.name}
                  width={420}
                  height={525}
                  sizes="(max-width: 560px) 80vw, (max-width: 900px) 45vw, 33vw"
                  loading={index < 3 ? undefined : "lazy"}
                />
                {(cake.cakeOfMonth || cake.featured) && (
                  <span className="ck-tag">{cake.cakeOfMonth ? "Bolo do mês" : "Especial"}</span>
                )}
              </div>
              <h3 className="ck-h">{cake.name.replace(/^Bolo /, "")}</h3>
              {cake.description && <p>{cake.description}</p>}
              <div className="ck-row">
                <span>
                  {cake.weightsKg.length > 0 && `a partir de ${kgLabel(Math.min(...cake.weightsKg))}`}
                  {cake.priceCents === null && " · preço em breve"}
                </span>
                <PickCakeButton cakeId={cake.id} />
              </div>
            </article>
          ))}
        </CakesRail>
        {cakes.some((cake) => cake.illustrativePhoto) && (
          <p className="ck-ai">
            Fotos dos bolos geradas por IA a partir do cardápio da Cake 67. Serão trocadas pelas fotos reais da loja.
          </p>
        )}
      </div>
    </section>
  );
}
