import { describe, expect, it, vi } from "vitest";
import { addressKey, hasQuotableAddress } from "@/lib/delivery/address";
import {
  estimateBody,
  estimateDelivery,
  listCategories,
  machineHeaders,
  parseCategories,
  parseEstimate,
  readMachineConfig,
  type MachineConfig,
} from "@/lib/delivery/machine";
import { deliverySetupProblem } from "@/lib/delivery/setup";
import { storeSchema } from "@/lib/validators/store";

const config: MachineConfig = {
  url: "https://api.taximachine.com.br/api/v2/integracao",
  apiKey: "mch_api_test",
  username: "integracao@example.com",
  password: "s3cret",
};
const store = { street: "Rua Estiva", number: "200", district: "Centro" };
const customer = { street: "Rua 14 de Julho", number: "1500", district: "Centro" };

describe("readMachineConfig", () => {
  it("needs all four variables and https", () => {
    const env = {
      MACHINE_API_URL: "https://api.taximachine.com.br/api/v2/integracao/",
      MACHINE_API_KEY: "k",
      MACHINE_USERNAME: "u",
      MACHINE_PASSWORD: "p",
    };
    expect(readMachineConfig(env)).toEqual({ url: "https://api.taximachine.com.br/api/v2/integracao", apiKey: "k", username: "u", password: "p" });
    expect(readMachineConfig({ ...env, MACHINE_PASSWORD: "" })).toBeNull();
    expect(readMachineConfig({ ...env, MACHINE_API_URL: "http://api.taximachine.com.br" })).toBeNull();
    expect(readMachineConfig({})).toBeNull();
  });
});

describe("Machine requests", () => {
  it("sends the api-key and Basic auth", () => {
    const headers = machineHeaders(config);
    expect(headers["api-key"]).toBe("mch_api_test");
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("integracao@example.com:s3cret").toString("base64")}`);
  });

  it("builds the estimate body for Campo Grande - MS", () => {
    expect(estimateBody(store, customer, "71")).toEqual({
      endereco_partida: "Rua Estiva, 200",
      bairro_partida: "Centro",
      cidade_partida: "Campo Grande",
      estado_partida: "MS",
      endereco_desejado: "Rua 14 de Julho, 1500",
      bairro_desejado: "Centro",
      cidade_desejado: "Campo Grande",
      estado_desejado: "MS",
      categoria_id: 71,
    });
  });
});

describe("parseEstimate", () => {
  const ok = (value: unknown) => ({ success: true, data: { estimativa_valor: value, estimativa_km: 4.051, estimativa_minutos: 7 } });

  it("converts reais to cents", () => {
    expect(parseEstimate(200, ok(12.4))).toEqual({ ok: true, feeCents: 1240, km: 4.05, minutes: 7 });
    expect(parseEstimate(200, ok("9.99"))).toMatchObject({ ok: true, feeCents: 999 });
  });

  it("rejects zero, negative, absurd and missing values", () => {
    for (const value of [0, -5, 300.01, "abc", null]) expect(parseEstimate(200, ok(value)).ok).toBe(false);
    expect(parseEstimate(200, ok(300))).toMatchObject({ ok: true, feeCents: 30000 });
  });

  it("keeps Juma's error codes for the log", () => {
    const body = { success: false, errors: [{ code: 17, message: "Endereço de destino não encontrado" }] };
    expect(parseEstimate(400, body)).toEqual({ ok: false, error: "17: Endereço de destino não encontrado" });
    expect(parseEstimate(500, null)).toEqual({ ok: false, error: "HTTP 500" });
  });
});

describe("parseCategories", () => {
  it("reads ids as text and skips odd rows", () => {
    const body = { success: true, data: [{ id: "71", nome: "Moto" }, { id: 162, nome: "Carro" }, { id: "x", nome: "?" }, { nome: "sem id" }] };
    expect(parseCategories(200, body)).toEqual({
      ok: true,
      categories: [
        { id: "71", name: "Moto" },
        { id: "162", name: "Carro" },
      ],
    });
  });

  it("treats a missing list as empty", () => {
    expect(parseCategories(200, { success: true })).toEqual({ ok: true, categories: [] });
    expect(parseCategories(400, { success: false, errors: [{ code: 1, message: "Usuário e/ou senhas inválidos" }] }).ok).toBe(false);
  });
});

describe("HTTP calls", () => {
  it("posts the estimate and parses the answer", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { estimativa_valor: 15 } }), { status: 200 }));
    const result = await estimateDelivery(config, store, customer, "71", fetchMock as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: true, feeCents: 1500 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${config.url}/entregas/estimativas`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).categoria_id).toBe(71);
  });

  it("turns a timeout or network error into a failure", async () => {
    const timeout = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    expect(await estimateDelivery(config, store, customer, "71", timeout as unknown as typeof fetch)).toEqual({ ok: false, error: "timeout" });
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect((await listCategories(config, offline as unknown as typeof fetch)).ok).toBe(false);
  });

  it("lists categories around the center of Campo Grande", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: [{ id: "71", nome: "Moto" }] })));
    await listCategories(config, fetchMock as unknown as typeof fetch);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe(`${config.url}/configuracoes/categorias?lat=-20.4697&lng=-54.6201`);
  });
});

describe("delivery address", () => {
  it("reuses a quote regardless of spacing, keeping case", () => {
    expect(addressKey({ street: "  Rua  14 de Julho ", number: "1500", district: "Centro" })).toBe("Rua 14 de Julho|1500|Centro");
    expect(addressKey({ street: "rua 14 de julho", number: "1500", district: "Centro" })).not.toBe("Rua 14 de Julho|1500|Centro");
  });

  it("needs street, number and district to quote", () => {
    expect(hasQuotableAddress({ delivery_street: "Rua A", delivery_number: "1", delivery_district: "Centro" })).toBe(true);
    expect(hasQuotableAddress({ delivery_street: "Rua A", delivery_number: " ", delivery_district: "Centro" })).toBe(false);
  });
});

describe("store delivery setup", () => {
  const ready = { address_street: "Rua Estiva", address_number: "200", address_district: "Centro", delivery_category_id: "71" };

  it("says what is missing", () => {
    expect(deliverySetupProblem(ready, true)).toBeNull();
    expect(deliverySetupProblem(ready, false)).toBe("credentials");
    expect(deliverySetupProblem({ ...ready, address_district: " " }, true)).toBe("address");
    expect(deliverySetupProblem({ ...ready, delivery_category_id: null }, true)).toBe("category");
  });

  it("reads the category select of the store form", () => {
    const base = {
      name: "Loja 1",
      address: "Rua Estiva, 200",
      whatsapp_ready: "(67) 99827-2300",
      whatsapp_made_to_order: "(67) 98151-9796",
      whatsapp_support: "(67) 99328-5925",
      hours: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
    };
    expect(storeSchema.parse({ ...base, delivery_category: "71|Moto", address_street: " Rua  Estiva " })).toMatchObject({
      address_street: "Rua Estiva",
      address_number: null,
      delivery_category: { delivery_category_id: "71", delivery_category_name: "Moto" },
    });
    expect(storeSchema.parse({ ...base, delivery_category: "" }).delivery_category).toEqual({
      delivery_category_id: null,
      delivery_category_name: null,
    });
    expect(storeSchema.safeParse({ ...base, delivery_category: "Moto" }).success).toBe(false);
  });
});
