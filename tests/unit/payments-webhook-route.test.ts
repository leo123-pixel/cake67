import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentOutcome, WebhookDeps } from "@/lib/payments/webhook";

// The route's dependencies that need the server (database, Stripe API) are
// replaced; signature checking and event handling run for real.
const fake = vi.hoisted(() => ({ deps: null as unknown as WebhookDeps }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/payments/refund", () => ({ webhookDeps: () => fake.deps }));

const { POST } = await import("@/app/api/stripe/webhook/[account]/route");

const SECRET = "whsec_test_route";
const payload = JSON.stringify({
  id: "evt_1",
  type: "checkout.session.expired",
  data: { object: { id: "cs_1" } },
});

function request(body: string, signature?: string) {
  return new Request("http://localhost/api/stripe/webhook/loja1", {
    method: "POST",
    body,
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

const props = (account: string) => ({ params: Promise.resolve({ account }) });
const signed = (body: string, secret = SECRET) => Stripe.webhooks.generateTestHeaderString({ payload: body, secret });

beforeEach(() => {
  vi.stubEnv("STRIPE_LOJA1_SECRET_KEY", "sk_test_route");
  vi.stubEnv("STRIPE_LOJA1_WEBHOOK_SECRET", SECRET);
  fake.deps = {
    settle: vi.fn(),
    close: vi.fn(async (): Promise<PaymentOutcome> => ({ action: "ok", payment_id: "p1" })),
    markRefund: vi.fn(),
    paymentMethod: vi.fn(),
    chargeRefunded: vi.fn(),
    refund: vi.fn(),
  };
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/stripe/webhook/[account]", () => {
  it("handles a correctly signed event of the account", async () => {
    const response = await POST(request(payload, signed(payload)), props("loja1"));
    expect(response.status).toBe(200);
    expect(fake.deps.close).toHaveBeenCalledWith("loja1", "cs_1", "expirado");
  });

  it("refuses an unknown or unconfigured account before reading the body", async () => {
    expect((await POST(request(payload, signed(payload)), props("loja2"))).status).toBe(404);
    expect((await POST(request(payload, signed(payload)), props("Loja1"))).status).toBe(404);
    expect(fake.deps.close).not.toHaveBeenCalled();
  });

  it("refuses a missing or wrong signature without touching the database", async () => {
    expect((await POST(request(payload), props("loja1"))).status).toBe(400);
    expect((await POST(request(payload, signed(payload, "whsec_other_account")), props("loja1"))).status).toBe(400);
    const tampered = payload.replace("cs_1", "cs_2");
    expect((await POST(request(tampered, signed(payload)), props("loja1"))).status).toBe(400);
    expect(fake.deps.close).not.toHaveBeenCalled();
  });

  it("answers 500 when the database fails, so Stripe retries", async () => {
    fake.deps.close = vi.fn(async () => Promise.reject(new Error("db down")));
    expect((await POST(request(payload, signed(payload)), props("loja1"))).status).toBe(500);
  });

  it("acknowledges events that are not ours, so Stripe does not retry them", async () => {
    fake.deps.close = vi.fn(async (): Promise<PaymentOutcome> => ({ action: "ignore" }));
    expect((await POST(request(payload, signed(payload)), props("loja1"))).status).toBe(200);
    const other = JSON.stringify({ id: "evt_2", type: "customer.created", data: { object: {} } });
    expect((await POST(request(other, signed(other)), props("loja1"))).status).toBe(200);
  });
});
