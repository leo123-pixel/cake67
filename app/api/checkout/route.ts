import { NextResponse } from "next/server";
import { z } from "zod";
import { startCheckout } from "@/lib/payments/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ code: z.string().max(20), token: z.string().max(64) });

// Opens the InfinitePay link of an order created by placeOrder (spec 12). The
// browser only says which order; the amount comes from the database.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "not_found", message: "Pedido não encontrado." }, { status: 400 });

  const result = await startCheckout(parsed.data.code, parsed.data.token);
  const status = result.ok ? 200 : result.reason === "failed" ? 502 : result.reason === "not_found" ? 404 : 409;
  return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
