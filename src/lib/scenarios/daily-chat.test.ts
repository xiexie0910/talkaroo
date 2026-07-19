import { describe, expect, it } from "vitest";
import {
  PROMPT_MUST_INCLUDE,
  dailyChat,
} from "@/lib/scenarios/daily-chat";

describe("daily-chat prompt", () => {
  it("forbids grammar lectures and allows phrase lifeline", () => {
    for (const needle of PROMPT_MUST_INCLUDE) {
      expect(dailyChat.systemInstruction).toContain(needle);
    }
  });

  it("has a Korean starter line", () => {
    expect(dailyChat.starterLine.length).toBeGreaterThan(0);
  });
});
