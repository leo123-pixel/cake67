// Juma Entregas runs on the Machine platform (API v2, "Entregas"):
// https://docs.machine.global/llms.txt. Every call needs the api-key header
// and Basic auth with the login of a "Gestor" user of the Cake 67 company.
// This file has no secrets of its own and no "server-only" import so the
// pure helpers can be unit tested; the env is read only on the server.

export type MachineConfig = { url: string; apiKey: string; username: string; password: string };

export type DeliveryAddress = { street: string; number: string; district: string };

export type Category = { id: string; name: string };

export type EstimateResult =
  | { ok: true; feeCents: number; km: number | null; minutes: number | null }
  | { ok: false; error: string };

export type CategoriesResult = { ok: true; categories: Category[] } | { ok: false; error: string };

// Deliveries are only in Campo Grande - MS (spec 11, out of scope otherwise).
export const CITY = "Campo Grande";
export const STATE = "MS";
// Center of Campo Grande, to list the categories of the central that serves it.
export const CITY_CENTER = { lat: -20.4697, lng: -54.6201 };

export const TIMEOUT_MS = 8000;
// Above this the estimate is treated as an error (spec 11, edge cases).
export const MAX_FEE_CENTS = 30000;

type Env = Record<string, string | undefined>;

// Null when any variable is missing: delivery then falls back to "a combinar".
export function readMachineConfig(env: Env = process.env): MachineConfig | null {
  const url = env.MACHINE_API_URL?.trim().replace(/\/+$/, "");
  const apiKey = env.MACHINE_API_KEY?.trim();
  const username = env.MACHINE_USERNAME?.trim();
  const password = env.MACHINE_PASSWORD;
  if (!url || !/^https:\/\//.test(url) || !apiKey || !username || !password) return null;
  return { url, apiKey, username, password };
}

export function machineHeaders(config: MachineConfig): Record<string, string> {
  const basic = Buffer.from(`${config.username}:${config.password}`, "utf8").toString("base64");
  return {
    "api-key": config.apiKey,
    Authorization: `Basic ${basic}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export function estimateBody(from: DeliveryAddress, to: DeliveryAddress, categoryId: string) {
  return {
    endereco_partida: `${from.street}, ${from.number}`,
    bairro_partida: from.district,
    cidade_partida: CITY,
    estado_partida: STATE,
    endereco_desejado: `${to.street}, ${to.number}`,
    bairro_desejado: to.district,
    cidade_desejado: CITY,
    estado_desejado: STATE,
    categoria_id: Number(categoryId),
  };
}

function describeErrors(body: unknown, status: number): string {
  const errors = (body as { errors?: unknown } | null)?.errors;
  if (Array.isArray(errors) && errors.length) {
    return errors
      .map((e) => {
        const item = e as { code?: unknown; message?: unknown };
        return `${String(item.code ?? "?")}: ${String(item.message ?? "")}`.trim();
      })
      .join("; ")
      .slice(0, 500);
  }
  return `HTTP ${status}`;
}

// estimativa_valor is in reais (e.g. 12.4); the site works in cents.
export function parseEstimate(status: number, body: unknown): EstimateResult {
  const data = (body as { success?: unknown; data?: Record<string, unknown> } | null) ?? null;
  if (status !== 200 || data?.success !== true || !data.data) return { ok: false, error: describeErrors(body, status) };

  const value = Number(data.data.estimativa_valor);
  if (!Number.isFinite(value)) return { ok: false, error: "estimativa_valor is not a number" };
  const feeCents = Math.round(value * 100);
  if (feeCents <= 0 || feeCents > MAX_FEE_CENTS) return { ok: false, error: `estimativa_valor out of range: ${value}` };

  const km = Number(data.data.estimativa_km);
  const minutes = Number(data.data.estimativa_minutos);
  return {
    ok: true,
    feeCents,
    km: Number.isFinite(km) ? Math.round(km * 100) / 100 : null,
    minutes: Number.isInteger(minutes) ? minutes : null,
  };
}

export function parseCategories(status: number, body: unknown): CategoriesResult {
  const data = (body as { success?: unknown; data?: unknown } | null) ?? null;
  if (status !== 200 || data?.success !== true) return { ok: false, error: describeErrors(body, status) };
  // "Quando não há nenhuma, o campo data não vem na resposta."
  const list = Array.isArray(data.data) ? data.data : [];
  const categories = list
    .map((item) => item as { id?: unknown; nome?: unknown })
    .filter((item) => /^\d{1,12}$/.test(String(item.id ?? "")) && typeof item.nome === "string")
    .map((item) => ({ id: String(item.id), name: String(item.nome).slice(0, 80) }));
  return { ok: true, categories };
}

type Fetch = typeof fetch;

async function call(fetchImpl: Fetch, url: string, init: RequestInit): Promise<{ status: number; body: unknown } | { error: string }> {
  try {
    const response = await fetchImpl(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body: unknown = await response.json().catch(() => null);
    return { status: response.status, body };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return { error: name === "TimeoutError" || name === "AbortError" ? "timeout" : `network: ${String(error).slice(0, 200)}` };
  }
}

export async function estimateDelivery(
  config: MachineConfig,
  from: DeliveryAddress,
  to: DeliveryAddress,
  categoryId: string,
  fetchImpl: Fetch = fetch,
): Promise<EstimateResult> {
  const result = await call(fetchImpl, `${config.url}/entregas/estimativas`, {
    method: "POST",
    headers: machineHeaders(config),
    body: JSON.stringify(estimateBody(from, to, categoryId)),
  });
  if ("error" in result) return { ok: false, error: result.error };
  return parseEstimate(result.status, result.body);
}

export async function listCategories(config: MachineConfig, fetchImpl: Fetch = fetch): Promise<CategoriesResult> {
  const query = new URLSearchParams({ lat: String(CITY_CENTER.lat), lng: String(CITY_CENTER.lng) });
  const result = await call(fetchImpl, `${config.url}/configuracoes/categorias?${query}`, {
    method: "GET",
    headers: machineHeaders(config),
  });
  if ("error" in result) return { ok: false, error: result.error };
  return parseCategories(result.status, result.body);
}
