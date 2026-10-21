"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const EVERY_MS = 3000;
const TRIES = 20; // about a minute

// Back from Stripe before its webhook arrived: refresh the order page until the
// payment shows up, for about a minute.
export function PaymentPoll() {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries > TRIES) {
        clearInterval(timer);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [router]);

  return gaveUp ? (
    <p className="text-sm text-cocoa-soft">O Pix pode levar alguns minutos para cair. Recarregue esta página mais tarde.</p>
  ) : null;
}
