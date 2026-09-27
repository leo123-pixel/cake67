import type { Metadata } from "next";
import { Marcellus, Montserrat } from "next/font/google";
import { siteUrl } from "@/lib/env";
import { OG_DEFAULTS } from "@/lib/seo";
import "./globals.css";

const marcellus = Marcellus({
  variable: "--font-marcellus",
  subsets: ["latin"],
  weight: "400",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const DESCRIPTION =
  "Bolos, fatias, doces e encomendas da Cake 67 em Campo Grande (MS). Veja o cardápio e faça seu pedido.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Cake 67 · Confeitaria em Campo Grande",
    template: "%s · Cake 67",
  },
  description: DESCRIPTION,
  openGraph: {
    ...OG_DEFAULTS,
    title: "Cake 67 · Confeitaria em Campo Grande",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${marcellus.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
