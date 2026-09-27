"use client";

import { pickCake, scrollToId } from "@/lib/site-events";

// "Montar este": selects the cake in the builder and scrolls to it.
export function PickCakeButton({ cakeId }: { cakeId: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        pickCake(cakeId);
        scrollToId("encomendas");
      }}
    >
      Montar este
    </button>
  );
}
