// Stripe accounts, one per store (spec 11, D5). A store points to an alias
// (stores.payment_account, e.g. "loja1"); the keys live only in server env
// vars named after it: STRIPE_LOJA1_SECRET_KEY and STRIPE_LOJA1_WEBHOOK_SECRET.
// Optional STRIPE_LOJA1_METHODS ("card,pix" by default) turns Pix off while an
// account still waits for it. Pure: the env is a parameter. Server code only
// (it reads the keys); the browser uses alias.ts.
import { accountEnvNames, isValidAlias } from "@/lib/payments/alias";

export { accountEnvNames, isValidAlias };

export type PaymentMethod = "card" | "pix";
export type AccountState = "ativo" | "sem_chaves" | "desligado";

export type StripeAccount = {
  alias: string;
  secretKey: string;
  webhookSecret: string;
  methods: PaymentMethod[];
};

type Env = Record<string, string | undefined>;

const METHODS: readonly PaymentMethod[] = ["card", "pix"];

function parseMethods(value: string | undefined): PaymentMethod[] {
  const chosen = (value ?? "")
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter((m): m is PaymentMethod => (METHODS as readonly string[]).includes(m));
  return chosen.length > 0 ? [...new Set(chosen)] : [...METHODS];
}

// The account, or null when the alias is invalid or a key is missing.
export function readAccount(alias: string | null | undefined, env: Env = process.env): StripeAccount | null {
  if (!isValidAlias(alias)) return null;
  const names = accountEnvNames(alias);
  const secretKey = env[names.secretKey]?.trim();
  const webhookSecret = env[names.webhookSecret]?.trim();
  if (!secretKey || !webhookSecret) return null;
  return { alias, secretKey, webhookSecret, methods: parseMethods(env[names.methods]) };
}

// For the panel and the site: "ativo" takes payments, "sem_chaves" has an
// alias but no keys on the server (WhatsApp only), "desligado" has no alias.
export function accountState(alias: string | null | undefined, env: Env = process.env): AccountState {
  if (!alias) return "desligado";
  return readAccount(alias, env) ? "ativo" : "sem_chaves";
}
