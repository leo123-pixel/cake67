import "server-only";
import { checkoutParams, type CheckoutInput } from "@/lib/payments/checkout-params";
import { stripeFor } from "@/lib/payments/stripe";

// Opens the Checkout Session in the store's account. The payment attempt id is
// the idempotency key: a retried request returns the same session.
export async function createCheckout(alias: string, input: Omit<CheckoutInput, "methods">) {
  const { stripe, account } = stripeFor(alias);
  const session = await stripe.checkout.sessions.create(checkoutParams({ ...input, methods: account.methods }), {
    idempotencyKey: input.paymentId,
  });
  if (!session.url) throw new Error(`Checkout Session ${session.id} has no URL`);
  return { id: session.id, url: session.url };
}

// Closes sessions replaced by a newer attempt or by a cancelled order. Best
// effort: a session that cannot be closed expires on its own, and a payment
// that still gets through is refunded by the database rules.
export async function expireSessions(alias: string, sessionIds: string[]) {
  if (sessionIds.length === 0) return;
  const { stripe } = stripeFor(alias);
  await Promise.all(
    sessionIds.map(async (id) => {
      try {
        await stripe.checkout.sessions.expire(id);
      } catch (error) {
        console.warn(`Could not expire Checkout Session ${id}: ${error instanceof Error ? error.message : error}`);
      }
    }),
  );
}
