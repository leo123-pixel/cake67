import { describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "@/lib/image-upload";

describe("withTimeout", () => {
  it("resolves when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000, "upload")).resolves.toBe("ok");
    await expect(withTimeout(Promise.reject(new Error("boom")), 1000, "upload")).rejects.toThrow("boom");
  });

  it("rejects with TimeoutError when the promise never settles", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise<never>(() => {}), 60_000, "compression");
    vi.advanceTimersByTime(60_000);
    await expect(pending).rejects.toBeInstanceOf(TimeoutError);
    vi.useRealTimers();
  });
});
