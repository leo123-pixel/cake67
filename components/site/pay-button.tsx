"use client";

import { useState, useTransition } from "react";
import { startPayment } from "@/app/(site)/actions";

// "Pagar agora" on the order page (spec 11): opens a new Checkout Session for
// the order, priced by the database.
export function PayButton({ code, token }: { code: string; token: string }) {
  const [pending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function pay() {
    setMessage(null);
    startTransition(async () => {
      const result = await startPayment(code, token).catch(() => null);
      if (result?.ok) {
        setLeaving(true);
        window.location.assign(result.url);
        return;
      }
      setMessage(result?.message ?? "Não conseguimos abrir o pagamento agora. Tente de novo ou finalize pelo WhatsApp.");
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={pay}
        disabled={pending || leaving}
        className="btn w-full bg-olive text-lg text-linen hover:bg-olive-dark"
      >
        {pending || leaving ? "Abrindo o pagamento…" : "Pagar agora (Pix ou cartão)"}
      </button>
      {message && (
        <p role="alert" className="text-sm text-raspberry">
          {message}
        </p>
      )}
    </div>
  );
}
