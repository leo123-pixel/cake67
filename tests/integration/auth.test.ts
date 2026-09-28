// lib/auth.ts reads the session with getClaims, trusting that the project
// signs JWTs asymmetrically so verification happens locally. Guards that
// assumption against the real project and cleans up the user it creates.
import { existsSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = configured ? createClient<Database>(url!, serviceKey!, options) : null;
const users: string[] = [];

afterAll(async () => {
  for (const id of users) await service!.auth.admin.deleteUser(id);
});

describe.skipIf(!configured)("session claims", () => {
  it("verifies the signed-in user's JWT without calling the Auth server", async () => {
    const email = `qa-auth-${randomUUID().slice(0, 8)}@cake67.test`;
    const password = randomBytes(24).toString("base64url");
    const { data: created, error } = await service!.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    users.push(created.user.id);

    const userCalls: string[] = [];
    const client = createClient<Database>(url!, anonKey!, {
      ...options,
      global: {
        fetch: (input, init) => {
          const target = input instanceof Request ? input.url : String(input);
          if (target.includes("/auth/v1/user")) userCalls.push(target);
          return fetch(input, init);
        },
      },
    });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    const { data, error: claimsError } = await client.auth.getClaims();
    expect(claimsError).toBeNull();
    expect(data?.claims.sub).toBe(created.user.id);
    expect(data?.claims.email).toBe(email);
    expect(data?.header.alg).not.toBe("HS256");
    expect(userCalls).toEqual([]);
  });
});
