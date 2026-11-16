"use client";

import { useState, useTransition } from "react";

// "Pagar agora" on the order page: opens (or reopens) the InfinitePay link.
export function PayButton({ code, token, label = "Pagar agora" }: { code: string; token: string; label?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pay() {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, token }),
        });
        const result = (await response.json()) as { ok: boolean; url?: string; message?: string };
        if (result.ok && result.url) {
          window.location.assign(result.url);
          return;
        }
        setMessage(result.message ?? "Não conseguimos abrir o pagamento agora. Tente de novo ou finalize pelo WhatsApp.");
      } catch {
        setMessage("Não conseguimos abrir o pagamento agora. Tente de novo ou finalize pelo WhatsApp.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={pay} disabled={pending} className="btn w-full bg-olive text-lg text-linen hover:bg-olive-dark">
        {pending ? "Abrindo pagamento…" : label}
      </button>
      {message && (
        <p role="alert" className="text-sm text-raspberry">
          {message}
        </p>
      )}
    </div>
  );
}
