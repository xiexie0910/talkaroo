import { describe, expect, it } from "vitest";
import { getScenario, scenarios } from "@/lib/scenarios/catalog";
import { PROMPT_MUST_INCLUDE } from "@/lib/scenarios/promptShared";

describe("scenario catalog", () => {
  it("includes multiple practice scenarios", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps grammar ban + phrase lifeline in every prompt", () => {
    for (const scenario of scenarios) {
      for (const needle of PROMPT_MUST_INCLUDE) {
        expect(scenario.systemInstruction).toContain(needle);
      }
      expect(scenario.starterLine.length).toBeGreaterThan(0);
    }
  });

  it("falls back to daily chat for unknown ids", () => {
    expect(getScenario("nope").id).toBe("daily-chat");
  });
});
