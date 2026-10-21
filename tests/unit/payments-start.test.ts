import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// startPayment with the database and Stripe calls replaced; account reading
// and the decisions around them run for real.
const db = vi.hoisted(() => ({
  beginOrderPayment: vi.fn(),
  attachPaymentSession: vi.fn(),
  failPaymentAttempt: vi.fn(),
}));
const checkout = vi.hoisted(() => ({ createCheckout: vi.fn(), expireSessions: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: vi.fn() }));
vi.mock("@/lib/payments/db", () => db);
vi.mock("@/lib/payments/checkout", () => checkout);

const { startPayment } = await import("@/app/(site)/actions");

const CODE = "C67-000123";
const TOKEN = "0123456789abcdef0123456789abcdef";
const attempt = {
  payment_id: "3f1c2a9e-7a51-4f0e-9d0c-1b2c3d4e5f60",
  account: "loja1",
  amount_cents: 27180,
  code: CODE,
  expires_at: "2026-10-21T15:31:00.000Z",
  stale_sessions: ["cs_old"],
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.cake67.com.br/");
  vi.stubEnv("STRIPE_LOJA1_SECRET_KEY", "sk_test_1");
  vi.stubEnv("STRIPE_LOJA1_WEBHOOK_SECRET", "whsec_1");
  db.beginOrderPayment.mockResolvedValue(attempt);
  db.attachPaymentSession.mockResolvedValue(true);
  db.failPaymentAttempt.mockResolvedValue(undefined);
  checkout.createCheckout.mockResolvedValue({ id: "cs_new", url: "https://checkout.stripe.com/c/pay/cs_new" });
  checkout.expireSessions.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("startPayment", () => {
  it("opens the session in the store's account with the database amount", async () => {
    expect(await startPayment(CODE, TOKEN)).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_new" });
    expect(db.beginOrderPayment).toHaveBeenCalledWith(CODE, TOKEN);
    expect(checkout.expireSessions).toHaveBeenCalledWith("loja1", ["cs_old"]);
    expect(checkout.createCheckout).toHaveBeenCalledWith("loja1", {
      paymentId: attempt.payment_id,
      code: CODE,
      token: TOKEN,
      amountCents: 27180,
      expiresAt: attempt.expires_at,
      siteUrl: "https://www.cake67.com.br",
    });
    expect(db.attachPaymentSession).toHaveBeenCalledWith(attempt.payment_id, "cs_new");
  });

  it("rejects a malformed code or token without touching the database", async () => {
    expect(await startPayment("C67-1", TOKEN)).toEqual({ ok: false, message: "Pedido não encontrado." });
    expect(await startPayment(CODE, "nope")).toMatchObject({ ok: false });
    expect(db.beginOrderPayment).not.toHaveBeenCalled();
  });

  it.each([
    ["CK040", "Este pedido não aceita mais pagamento."],
    ["CK041", "Este pedido já foi pago."],
    ["CK042", "Esta loja não recebe pagamento pelo site. Finalize pelo WhatsApp."],
    ["CK043", "Limite de tentativas atingido. Finalize pelo WhatsApp."],
  ])("explains %s", async (code, message) => {
    db.beginOrderPayment.mockRejectedValue(Object.assign(new Error(code), { code }));
    expect(await startPayment(CODE, TOKEN)).toEqual({ ok: false, message });
    expect(checkout.createCheckout).not.toHaveBeenCalled();
  });

  it("falls back to WhatsApp when the store's alias has no keys on the server", async () => {
    db.beginOrderPayment.mockResolvedValue({ ...attempt, account: "loja2" });
    expect(await startPayment(CODE, TOKEN)).toMatchObject({ ok: false, message: expect.stringContaining("WhatsApp") });
    expect(db.failPaymentAttempt).toHaveBeenCalledWith(attempt.payment_id);
    expect(checkout.createCheckout).not.toHaveBeenCalled();
  });

  it("marks the attempt failed when Stripe refuses the session", async () => {
    checkout.createCheckout.mockRejectedValue(new Error("stripe down"));
    expect(await startPayment(CODE, TOKEN)).toMatchObject({ ok: false });
    expect(db.failPaymentAttempt).toHaveBeenCalledWith(attempt.payment_id);
  });

  it("expires a session it could not record", async () => {
    db.attachPaymentSession.mockRejectedValue(new Error("db down"));
    expect(await startPayment(CODE, TOKEN)).toMatchObject({ ok: false });
    expect(checkout.expireSessions).toHaveBeenLastCalledWith("loja1", ["cs_new"]);
    expect(db.failPaymentAttempt).toHaveBeenCalledWith(attempt.payment_id);
  });

  it("expires its own session when a newer tab replaced the attempt", async () => {
    db.attachPaymentSession.mockResolvedValue(false);
    expect(await startPayment(CODE, TOKEN)).toEqual({ ok: false, message: "O pagamento foi aberto em outra aba. Use a mais recente." });
    expect(checkout.expireSessions).toHaveBeenLastCalledWith("loja1", ["cs_new"]);
  });
});
