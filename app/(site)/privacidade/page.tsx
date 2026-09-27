import type { Metadata } from "next";
import { getPublicSettings } from "@/lib/storefront";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "Como a Cake 67 trata os dados informados nos pedidos feitos pelo site.",
};

export default async function PrivacyPage() {
  const settings = await getPublicSettings();
  const paragraphs = settings.privacy_text.trim() ? settings.privacy_text.trim().split(/\n{2,}/) : [];

  return (
    <div className="bg-linen text-cocoa">
      <section className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-8">
        <h1 className="text-4xl text-olive">Privacidade</h1>
        {!settings.privacy_reviewed && (
          <p className="inline-block rounded-full bg-peach px-3 py-1 text-xs font-medium">Texto provisório</p>
        )}
        {paragraphs.length ? (
          paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))
        ) : (
          <p>Fale com a loja pelo WhatsApp para saber como tratamos seus dados.</p>
        )}
      </section>
    </div>
  );
}
