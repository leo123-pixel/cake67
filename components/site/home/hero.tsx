import Image from "next/image";
import type { Store } from "@/lib/catalog";
import { Parallax } from "./parallax";

// Brand facts given by the client for the prototype (AD-012 keeps them).
const BRAND_YEARS = "15 anos";
const INSTAGRAM_FOLLOWERS = "89,7 mil";

const FLOATS = [
  { className: "ck-f1", src: "/home/croissant-ninho.webp", depth: 18, width: 440, height: 439 },
  { className: "ck-f2", src: "/home/brigadeiro.webp", depth: -14, width: 440, height: 432 },
  { className: "ck-f3", src: "/home/coxinha-pistache.webp", depth: 22, width: 440, height: 414 },
];

// "Rua Estiva, 200" -> "Rua Estiva"; "Av. Afonso Pena, 2716" -> "Afonso Pena".
function street(address: string) {
  return address.split(",")[0].replace(/^Av(enida)?\.?\s+/i, "");
}

export function Intro() {
  return (
    <div className="ck-intro" aria-hidden="true">
      <div className="ck-in">
        <span className="ck-mark" />
        <span className="ck-word" />
      </div>
    </div>
  );
}

export function Hero({ stores, cakesHref }: { stores: Store[]; cakesHref: string }) {
  const places = stores.map((store) => street(store.address));

  return (
    <section className="ck-hero">
      <div className="ck-wrap">
        <div>
          <p className="ck-eyebrow" style={{ color: "var(--color-peach)" }}>
            Doceria · Campo Grande · MS
          </p>
          <h1 className="ck-h">
            Bolos, fatias e docinhos <em>feitos pra celebrar.</em>
          </h1>
          <p className="ck-lead">
            Monte sua encomenda, veja o que tem na vitrine de cada loja e envie o pedido pelo WhatsApp, onde a loja combina
            o pagamento com você.{places.length > 0 && ` Retire na ${places.join(" ou na ")}.`}
          </p>
          <div className="ck-ctas">
            <a className="ck-btn ck-btn-peach" href={cakesHref}>
              Encomendar um bolo
            </a>
            <a className="ck-btn ck-btn-line" href="#vitrine">
              Ver a vitrine de hoje
            </a>
          </div>
          <div className="ck-meta">
            <span>
              <b>
                {stores.length} {stores.length === 1 ? "loja" : "lojas"}
              </b>{" "}
              em Campo Grande
            </span>
            <span>
              <b>{BRAND_YEARS}</b> de marca
            </span>
            <span>
              <b>{INSTAGRAM_FOLLOWERS}</b> no Instagram
            </span>
          </div>
        </div>
        <div className="ck-stage" id="ck-stage">
          <div className="ck-arch">
            <Image
              src="/home/bolo-ninho-morango.webp"
              alt="Bolo retangular de Ninho com morangos e farofa caramelizada numa travessa branca"
              width={725}
              height={900}
              priority
              sizes="(max-width: 860px) 380px, 520px"
            />
          </div>
          <span className="ck-cap">Imagem ilustrativa</span>
          {FLOATS.map((float) => (
            <div key={float.src} className={`ck-float ${float.className}`} data-depth={float.depth}>
              <Image src={float.src} alt="" width={float.width} height={float.height} sizes="170px" />
            </div>
          ))}
          <div className="ck-seal" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <defs>
                <path id="ck-ring" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
              </defs>
              <text fontFamily="Montserrat,sans-serif" fontSize="9.4" fontWeight="600" letterSpacing="3.1" fill="#5F6340">
                <textPath href="#ck-ring">FEITO À MÃO · CAMPO GRANDE · CAKE67 · </textPath>
              </text>
            </svg>
            <span className="ck-mark" />
          </div>
          <Parallax />
        </div>
      </div>
    </section>
  );
}

const MARQUEE = ["Bolos sob encomenda", "Fatias da semana", "Croissants montados na hora", "Coxinha de morango", "Copo da Felicidade", "Cakelovers"];

export function Marquee() {
  const run = (copy: number) =>
    MARQUEE.flatMap((text) => [<span key={`${copy}-${text}`}>{text}</span>, <span key={`${copy}-${text}-m`} className="ck-mark" />]);
  return (
    <div className="ck-marquee" aria-hidden="true">
      <div className="ck-track">
        {run(1)}
        {run(2)}
      </div>
    </div>
  );
}
