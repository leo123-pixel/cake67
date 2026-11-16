import { NextResponse } from "next/server";
import { WEBHOOK_CHECK_TIMEOUT_MS } from "@/lib/infinitepay";
import { handleWebhook } from "@/lib/payments/confirm";
import { confirmDeps } from "@/lib/payments/server";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// InfinitePay webhook (spec 12, D6). Not signed: the body is logged, then the
// transaction is confirmed by /payment_check before anything changes. 200 =
// handled (or nothing to do); 400 = try again later.
export async function POST(request: Request) {
  const body = await request.text();
  const result = await handleWebhook(body, confirmDeps(), WEBHOOK_CHECK_TIMEOUT_MS);
  if (result.status !== 200) console.warn(`infinitepay webhook: ${result.outcome}`);
  return NextResponse.json({ ok: result.status === 200, outcome: result.outcome }, { status: result.status });
}
