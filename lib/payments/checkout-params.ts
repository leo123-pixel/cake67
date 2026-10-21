// Checkout Session parameters for an order (spec 11, D3/D4/D9). Pure, so the
// amount, methods and expirations can be tested without Stripe.
import type Stripe from "stripe";
import type { PaymentMethod } from "@/lib/payments/accounts";

// Time to pay a Pix QR code, counted from when the customer chooses Pix (that
// is how Stripe counts it). A Pix chosen at the very end of the session may be
// paid a few minutes after the reservation's 5 min slack: the database then
// reserves the order again or refunds it (spec D10).
export const PIX_EXPIRES_SECONDS = 10 * 60;

export type CheckoutInput = {
  paymentId: string;
  code: string;
  token: string;
  amountCents: number;
  expiresAt: string; // from begin_order_payment: 30 min to 23 h ahead
  methods: PaymentMethod[];
  siteUrl: string; // no trailing slash
};

export function orderUrl(siteUrl: string, code: string, token: string, payment?: "ok" | "cancelado" | "erro") {
  const params = new URLSearchParams({ t: token });
  if (payment) params.set("pagamento", payment);
  return `${siteUrl}/pedido/${encodeURIComponent(code)}?${params}`;
}

export function checkoutParams(input: CheckoutInput): Stripe.Checkout.SessionCreateParams {
  const metadata = { payment_id: input.paymentId, order_code: input.code };
  return {
    mode: "payment",
    // One line with the order total (D3): the database already priced every item.
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "brl",
          unit_amount: input.amountCents,
          product_data: { name: `Pedido ${input.code}` },
        },
      },
    ],
    // Filter on the methods the account has enabled: a Pix not yet released
    // by Stripe simply does not show up.
    allowed_payment_method_types: input.methods,
    ...(input.methods.includes("pix") && { payment_method_options: { pix: { expires_after_seconds: PIX_EXPIRES_SECONDS } } }),
    expires_at: Math.floor(new Date(input.expiresAt).getTime() / 1000),
    locale: "pt-BR",
    client_reference_id: input.paymentId,
    metadata,
    payment_intent_data: { metadata },
    success_url: orderUrl(input.siteUrl, input.code, input.token, "ok"),
    cancel_url: orderUrl(input.siteUrl, input.code, input.token, "cancelado"),
  };
}
