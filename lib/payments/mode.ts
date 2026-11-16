// NEXT_PUBLIC_PAYMENT_MODE=whatsapp turns online payment off everywhere (the
// site goes back to "Finalizar no WhatsApp"). Anything else, or unset, means
// InfinitePay where the store has an account with a key on the server.
export type PaymentMode = "infinitepay" | "whatsapp";

export function parsePaymentMode(value: string | undefined): PaymentMode {
  return value?.trim().toLowerCase() === "whatsapp" ? "whatsapp" : "infinitepay";
}

// Referenced literally so Next.js can inline it.
export function paymentMode(): PaymentMode {
  return parsePaymentMode(process.env.NEXT_PUBLIC_PAYMENT_MODE);
}
