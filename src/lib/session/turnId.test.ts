import { describe, expect, it } from "vitest";
import {
  createTurnId,
  shouldApplyCoachResult,
} from "@/lib/session/turnId";

describe("turnId supersede", () => {
  it("creates unique ids", () => {
    expect(createTurnId()).not.toEqual(createTurnId());
  });

  it("applies only when turn ids match", () => {
    const current = "turn_a";
    expect(shouldApplyCoachResult(current, "turn_a")).toBe(true);
    expect(shouldApplyCoachResult(current, "turn_b")).toBe(false);
    expect(shouldApplyCoachResult(null, "turn_a")).toBe(false);
  });
});
