import Stripe from "stripe";
import { readAccount } from "@/lib/payments/accounts";
import { webhookDeps } from "@/lib/payments/refund";
import { handleStripeEvent } from "@/lib/payments/webhook";

// One endpoint per store account (spec 11, D8): each Stripe account sends its
// events to /api/stripe/webhook/<alias>, signed with its own secret.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ account: string }> };

export async function POST(request: Request, { params }: Props) {
  const { account: alias } = await params;
  const account = readAccount(alias);
  if (!account) return new Response("Unknown account", { status: 404 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  // The signature covers the raw body: read it before any parsing.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(body, signature, account.webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const result = await handleStripeEvent(alias, event, webhookDeps(alias));
    const outcome = result.outcome?.action ?? (result.handled ? "handled" : "skipped");
    // Ids only: no customer data in the logs.
    console.info(`stripe ${alias} ${event.id} ${event.type}: ${outcome}${result.outcome?.payment_id ? ` (${result.outcome.payment_id})` : ""}`);
    if (outcome === "ignore") {
      // Not one of our sessions (a test event, another integration): retrying would not help.
      console.warn(`stripe ${alias} ${event.id}: no matching payment attempt`);
    }
    return Response.json({ received: true });
  } catch (error) {
    // Stripe retries non-2xx answers with backoff for up to three days.
    console.error(`stripe ${alias} ${event.id} ${event.type} failed: ${error instanceof Error ? error.message : error}`);
    return new Response("Webhook handling failed", { status: 500 });
  }
}
