import { z } from "zod";
import { exportItems, exportOrders, ITEM_CSV_HEADER, ORDER_CSV_HEADER } from "@/lib/admin/report";
import { getAdminContext } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { todayInCampoGrande } from "@/lib/datetime";
import { resolvePeriod } from "@/lib/report";

const querySchema = z.object({
  tipo: z.enum(["pedidos", "itens"]),
  periodo: z.string().optional(),
  de: z.string().optional(),
  ate: z.string().optional(),
  loja: z.string().max(80).optional(),
});

// Admin-only CSV download (AD-011). Built in memory, so a failure never
// sends a partial file.
export async function GET(request: Request) {
  const context = await getAdminContext();
  if (!context) return new Response("Sem permissão.", { status: 403 });

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return new Response("Parâmetros inválidos.", { status: 400 });
  const { tipo, periodo, de, ate, loja } = parsed.data;

  const period = resolvePeriod(periodo, de, ate, todayInCampoGrande());
  if (period.notice) return new Response(period.notice, { status: 400 });

  const { supabase } = context;
  let storeId: string | undefined;
  if (loja) {
    const { data: store, error } = await supabase.from("stores").select("id").eq("slug", loja).maybeSingle();
    if (error) throw new Error(`Could not load store: ${error.message}`);
    if (!store) return new Response("Loja não encontrada.", { status: 400 });
    storeId = store.id;
  }

  const csv =
    tipo === "pedidos"
      ? toCsv(ORDER_CSV_HEADER, await exportOrders(supabase, period, storeId))
      : toCsv(ITEM_CSV_HEADER, await exportItems(supabase, period, storeId));

  const suffix = `${period.from}-a-${period.to}${loja ? `-${loja}` : ""}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cake67-${tipo}-${suffix}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
