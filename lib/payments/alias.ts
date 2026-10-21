// Store payment account aliases (spec 11, D5). Safe in the browser: no env
// reading here, only the alias rule and the variable names it maps to.

const ALIAS = /^[a-z0-9]{2,20}$/;

// Same rule as the stores_payment_account_check constraint.
export function isValidAlias(alias: string | null | undefined): alias is string {
  return typeof alias === "string" && ALIAS.test(alias);
}

export function accountEnvNames(alias: string) {
  const prefix = `STRIPE_${alias.toUpperCase()}`;
  return {
    secretKey: `${prefix}_SECRET_KEY`,
    webhookSecret: `${prefix}_WEBHOOK_SECRET`,
    methods: `${prefix}_METHODS`,
  };
}
