import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/env";
import { confirmFromReturn } from "@/lib/payments/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

type Params = { params: Promise<{ code: string; token: string }> };

// redirect_url of the InfinitePay link: the customer lands here after
// "Continuar". The query params (receipt_url, order_nsu, slug, capture_method,
// transaction_nsu) are not trusted; they only feed payment_check, in case the
// webhook is late. Then the customer goes to the order page.
export async function GET(request: NextRequest, { params }: Params) {
  const { code, token } = await params;
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());

  let outcome = "skipped";
  try {
    outcome = await confirmFromReturn(code, token, query);
  } catch (error) {
    console.error(`payment return ${code}: ${error instanceof Error ? error.message : error}`);
  }

  const target = new URL(`${siteUrl()}/pedido/${encodeURIComponent(code)}`);
  target.searchParams.set("t", token);
  target.searchParams.set("pagamento", outcome === "paid" || outcome === "duplicate" ? "ok" : "retorno");
  return NextResponse.redirect(target, 303);
}
