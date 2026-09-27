import Image from "next/image";
import type { Store } from "@/lib/catalog";
import { formatWhatsapp } from "@/lib/phone";
import { describeHours } from "@/lib/store-hours";

export function StoresSection({ stores }: { stores: Store[] }) {
  return (
    <section className="ck-sec ck-light ck-stores" id="lojas">
      <div className="ck-wrap">
        <div className="ck-paint ck-rv">
          <Image
            src="/home/fachada-mesas.webp"
            alt="Aquarela da varanda da Cake 67 com mesas e cadeiras rosa"
            width={373}
            height={400}
            sizes="(max-width: 900px) 460px, 40vw"
          />
          <Image
            className="ck-p2"
            src="/home/fachada-capa.webp"
            alt="Aquarela da fachada da Cake 67 com o monograma na parede de tijolos"
            width={202}
            height={260}
            sizes="220px"
          />
        </div>
        <div>
          <p className="ck-eyebrow">Nossas lojas</p>
          <h2 className="ck-h">Passa pra um café. Ou leva a festa inteira.</h2>
          <div className="ck-slist">
            {stores.map((store) => (
              <article key={store.id} className="ck-store">
                <h3 className="ck-h">{store.name}</h3>
                <p className="ck-addr">{store.address} · Campo Grande/MS</p>
                <dl>
                  <dt>Horário</dt>
                  <dd>{describeHours(store.hours) || "Consulte pelo WhatsApp"}</dd>
                  {store.phone && (
                    <>
                      <dt>Telefone</dt>
                      <dd>{store.phone}</dd>
                    </>
                  )}
                  <dt>WhatsApp</dt>
                  <dd>{formatWhatsapp(store.whatsapp)}</dd>
                </dl>
                <a className="ck-btn ck-btn-olive" href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const PERKS = [
  "Junte pontos a cada pedido feito pelo site ou na loja",
  "Receba o Bolo do Mês antes de todo mundo",
  "Entre na comunidade Cakelovers no WhatsApp",
];

// Loyalty program is not in the system yet: joining goes to WhatsApp (AD-012).
export function Cakelovers({ whatsapp }: { whatsapp: string | null }) {
  return (
    <section className="ck-sec ck-love" id="cakelovers">
      <div className="ck-wrap">
        <div>
          <p className="ck-eyebrow">Programa de fidelidade</p>
          <h2 className="ck-h">Vire Cakelover.</h2>
          <ul className="ck-perks">
            {PERKS.map((perk) => (
              <li key={perk}>
                <span className="ck-mark" />
                {perk}
              </li>
            ))}
          </ul>
          {whatsapp && (
            <a
              className="ck-btn ck-btn-olive ck-join"
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Olá, Cake 67! Quero participar do Cakelovers.")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Quero participar
            </a>
          )}
        </div>
        <Image
          className="ck-cardimg ck-rv"
          src="/home/cakelovers.webp"
          alt="Cartão fidelidade Cakelovers dourado com carimbos"
          width={384}
          height={460}
          sizes="(max-width: 860px) 240px, 340px"
        />
      </div>
    </section>
  );
}
