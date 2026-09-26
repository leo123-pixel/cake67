"use client";

import { useEffect } from "react";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto max-w-[1320px] px-4 py-24 sm:px-8">
      <h1 className="text-4xl text-peach">Não conseguimos carregar esta página agora.</h1>
      <p className="mt-4 text-linen/80">Tente de novo em instantes.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-full bg-peach px-7 py-3.5 text-xs font-semibold tracking-[0.14em] text-cocoa uppercase"
      >
        Tentar de novo
      </button>
    </section>
  );
}
