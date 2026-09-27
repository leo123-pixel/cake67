import type { Metadata } from "next";
import { getPublicSettings } from "@/lib/storefront";

export const metadata: Metadata = { title: "Privacidade" };

// Shown until the client approves the final policy (stage 06). It only states
// what the site actually does with the data it collects.
const PROVISIONAL_TEXT = [
  "Ao fazer um pedido pelo site, coletamos seu nome e WhatsApp e, se você informar, o endereço de entrega e o CPF ou CNPJ para a nota fiscal.",
  "Usamos esses dados apenas para atender o seu pedido, combinar retirada, entrega e pagamento e emitir a nota. Não vendemos nem compartilhamos seus dados para publicidade.",
  "O site não exige conta nem senha. O carrinho fica guardado apenas no seu aparelho.",
  "Para consultar, corrigir ou pedir a exclusão dos seus dados, fale com a loja pelo WhatsApp.",
];

export default async function PrivacyPage() {
  const settings = await getPublicSettings();
  const paragraphs = settings.privacy_text.trim()
    ? settings.privacy_text.split(/\n{2,}/)
    : PROVISIONAL_TEXT;

  return (
    <div className="bg-linen text-cocoa">
      <section className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-8">
        <h1 className="text-4xl text-olive">Privacidade</h1>
        <p className="inline-block rounded-full bg-peach px-3 py-1 text-xs font-medium">Texto provisório</p>
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </section>
    </div>
  );
}
