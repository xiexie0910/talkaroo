import { describe, expect, it } from "vitest";
import { takeToken } from "@/lib/rateLimit";

describe("takeToken", () => {
  it("allows up to the limit then rejects within the window", () => {
    const key = `test:${Date.now()}:${Math.random()}`;
    expect(takeToken(key, 2, 60_000)).toBe(true);
    expect(takeToken(key, 2, 60_000)).toBe(true);
    expect(takeToken(key, 2, 60_000)).toBe(false);
  });
});
