import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "@/lib/env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

describe("parsePublicEnv", () => {
  it("returns the parsed values when everything is set", () => {
    expect(parsePublicEnv(valid)).toEqual({
      supabaseUrl: "https://abc.supabase.co",
      supabaseAnonKey: "anon-key",
      siteUrl: "http://localhost:3000",
    });
  });

  it.each(Object.keys(valid))("names %s when it is missing", (name) => {
    expect(() => parsePublicEnv({ ...valid, [name]: undefined })).toThrow(name);
  });

  it("rejects a malformed URL", () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "abc" })).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL",
    );
  });
});

describe("parseServerEnv", () => {
  it("returns the service role key", () => {
    expect(parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "secret" })).toEqual({
      serviceRoleKey: "secret",
    });
  });

  it("names the key when it is empty", () => {
    expect(() => parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "" })).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
  });
});
