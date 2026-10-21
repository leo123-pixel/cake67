import "server-only";
import Stripe from "stripe";
import { readAccount, type StripeAccount } from "@/lib/payments/accounts";

// One client per account alias, reused across requests.
const clients = new Map<string, { secretKey: string; stripe: Stripe }>();

// Stripe client of a store's account. Throws when the account is not
// configured: callers check accountState/readAccount first.
export function stripeFor(alias: string): { stripe: Stripe; account: StripeAccount } {
  const account = readAccount(alias);
  if (!account) throw new Error(`Stripe account "${alias}" is not configured`);

  let cached = clients.get(alias);
  if (!cached || cached.secretKey !== account.secretKey) {
    cached = {
      secretKey: account.secretKey,
      stripe: new Stripe(account.secretKey, { maxNetworkRetries: 2, appInfo: { name: "cake67" } }),
    };
    clients.set(alias, cached);
  }
  return { stripe: cached.stripe, account };
}
