import { describe, expect, it } from "vitest";
import { accountEnvNames, accountState, isValidAlias, readAccount } from "@/lib/payments/accounts";
import { ATTEMPT_LABELS, ORDER_PAYMENT_LABELS, methodLabel, shownAttempts } from "@/lib/payments/labels";

const env = {
  STRIPE_LOJA1_SECRET_KEY: "sk_test_1",
  STRIPE_LOJA1_WEBHOOK_SECRET: "whsec_1",
  STRIPE_LOJA2_SECRET_KEY: "sk_test_2",
};

describe("isValidAlias", () => {
  it.each(["loja1", "ab", "a".repeat(20), "jeriba3"])("accepts %s", (alias) => {
    expect(isValidAlias(alias)).toBe(true);
  });

  it.each(["", "a", "a".repeat(21), "Loja1", "loja-1", "loja 1", "loja_1", null, undefined])("rejects %s", (alias) => {
    expect(isValidAlias(alias)).toBe(false);
  });
});

describe("accountEnvNames", () => {
  it("names the variables after the alias", () => {
    expect(accountEnvNames("loja1")).toEqual({
      secretKey: "STRIPE_LOJA1_SECRET_KEY",
      webhookSecret: "STRIPE_LOJA1_WEBHOOK_SECRET",
      methods: "STRIPE_LOJA1_METHODS",
    });
  });
});

describe("readAccount", () => {
  it("reads both keys, with card and Pix by default", () => {
    expect(readAccount("loja1", env)).toEqual({
      alias: "loja1",
      secretKey: "sk_test_1",
      webhookSecret: "whsec_1",
      methods: ["card", "pix"],
    });
  });

  it("needs both keys", () => {
    expect(readAccount("loja2", env)).toBeNull();
    expect(readAccount("loja1", { ...env, STRIPE_LOJA1_SECRET_KEY: " " })).toBeNull();
  });

  it("refuses an invalid alias before reading the env", () => {
    expect(readAccount("LOJA1", { ...env, STRIPE_LOJA1_SECRET_KEY: "sk", STRIPE_LOJA1_WEBHOOK_SECRET: "wh" })).toBeNull();
    expect(readAccount(null, env)).toBeNull();
  });

  it.each([
    ["card", ["card"]],
    [" PIX , card ", ["pix", "card"]],
    ["card,card", ["card"]],
    ["boleto", ["card", "pix"]],
    ["", ["card", "pix"]],
  ])("methods %j -> %j", (value, methods) => {
    expect(readAccount("loja1", { ...env, STRIPE_LOJA1_METHODS: value })?.methods).toEqual(methods);
  });
});

describe("accountState", () => {
  it("tells the three situations apart", () => {
    expect(accountState("loja1", env)).toBe("ativo");
    expect(accountState("loja2", env)).toBe("sem_chaves");
    expect(accountState("loja3", env)).toBe("sem_chaves");
    expect(accountState(null, env)).toBe("desligado");
    expect(accountState("", env)).toBe("desligado");
  });
});

describe("payment labels", () => {
  it("shows no badge for an order without payment", () => {
    expect(ORDER_PAYMENT_LABELS.nenhum).toBeNull();
    expect(ORDER_PAYMENT_LABELS.falha_devolucao).toBe("Reembolso pendente");
    expect(ATTEMPT_LABELS.falhou).toBe("Recusado");
  });

  it("lists only attempts where money arrived", () => {
    const attempts = (["aberto", "pago", "expirado", "falhou", "cancelado", "erro", "conferir", "devolvendo", "devolvido", "falha_devolucao"] as const).map(
      (status) => ({ status }),
    );
    expect(shownAttempts(attempts).map((a) => a.status)).toEqual(["pago", "conferir", "devolvendo", "devolvido", "falha_devolucao"]);
  });

  it("names the method", () => {
    expect(methodLabel("pix")).toBe("Pix");
    expect(methodLabel("card")).toBe("Cartão");
    expect(methodLabel("boleto")).toBeNull();
    expect(methodLabel(null)).toBeNull();
  });
});
