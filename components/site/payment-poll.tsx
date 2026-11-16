"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const EVERY_MS = 4000;
const TRIES = 20;

// Back from InfinitePay before the webhook arrived: reload the order a few
// times (about 80 s) so "Confirmando pagamento…" turns into "Pago".
export function PaymentPoll() {
  const router = useRouter();
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      router.refresh();
      if (tries >= TRIES) window.clearInterval(timer);
    }, EVERY_MS);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
