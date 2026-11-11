"use client";

import { useEffect, useState } from "react";
import { quoteDelivery, type DeliveryFee } from "@/app/(site)/actions";
import { hasQuotableAddress } from "@/lib/delivery/address";

export type DeliveryAddressFields = {
  delivery_street: string;
  delivery_number: string;
  delivery_complement: string;
  delivery_district: string;
  delivery_reference: string;
};

export type DeliveryFeeState = { status: "idle" } | { status: "loading" } | DeliveryFee;

const WAIT_MS = 700;

// Fee calculated on the server for the store and address (spec 11). Waits for
// the customer to stop typing; late answers are ignored. `override` replaces
// the value when placing the order found that the fee changed.
export function useDeliveryFee(storeId: string | null, enabled: boolean, address: DeliveryAddressFields) {
  const ready = enabled && storeId !== null && hasQuotableAddress(address);
  const signature = ready
    ? JSON.stringify([storeId, address.delivery_street.trim(), address.delivery_number.trim(), address.delivery_district.trim()])
    : null;
  const [result, setResult] = useState<{ signature: string; fee: DeliveryFee } | null>(null);

  useEffect(() => {
    if (!signature) return;
    const [store, street, number, district] = JSON.parse(signature) as string[];
    let active = true;
    const timer = setTimeout(() => {
      quoteDelivery(store, { delivery_street: street, delivery_number: number, delivery_district: district })
        .then((fee) => active && setResult({ signature, fee }))
        .catch(() => active && setResult({ signature, fee: { status: "a_combinar" } }));
    }, WAIT_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [signature]);

  const state: DeliveryFeeState = !signature
    ? { status: "idle" }
    : result?.signature === signature
      ? result.fee
      : { status: "loading" };

  // After placeOrder reports a new fee for the same address.
  const override = (fee: DeliveryFee) => signature && setResult({ signature, fee });
  return [state, override] as const;
}
