import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/safeRedirect";

describe("safeInternalPath", () => {
  it("allows normal internal paths", () => {
    expect(safeInternalPath("/session")).toBe("/session");
    expect(safeInternalPath("/session?scenario=cafe")).toBe(
      "/session?scenario=cafe",
    );
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeInternalPath("//evil.com")).toBe("/session");
    expect(safeInternalPath("https://evil.com")).toBe("/session");
    expect(safeInternalPath("/\\evil.com")).toBe("/session");
  });

  it("uses fallback for empty or relative non-paths", () => {
    expect(safeInternalPath(null, "/login")).toBe("/login");
    expect(safeInternalPath("session")).toBe("/session");
  });
});
