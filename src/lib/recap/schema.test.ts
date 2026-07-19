import { describe, expect, it } from "vitest";
import {
  genericFallbackRecap,
  safeParseSessionRecap,
  sessionRecapSchema,
} from "@/lib/recap/schema";

describe("sessionRecapSchema", () => {
  it("accepts a valid recap", () => {
    const parsed = sessionRecapSchema.parse({
      win: "You successfully ordered a drink and answered a follow-up.",
      focus: {
        korean: "아이스 라테로 주세요",
        english: "An iced latte, please.",
        reason: "Clear size + drink order pattern.",
      },
      nextMission: {
        scenarioId: "cafe-order",
        objective:
          "At the café, ask for an iced drink and say whether it is to go.",
        starterPhrase: "아이스 라테로 주세요",
      },
    });
    expect(parsed.focus.korean).toContain("라테");
  });

  it("rejects unknown scenario ids", () => {
    const result = safeParseSessionRecap({
      win: "Nice try.",
      focus: {
        korean: "안녕하세요",
        english: "Hello",
        reason: "Greeting",
      },
      nextMission: {
        scenarioId: "airport",
        objective: "Order at the airport",
        starterPhrase: "커피 주세요",
      },
    });
    expect(result.success).toBe(false);
  });

  it("genericFallbackRecap always validates", () => {
    expect(sessionRecapSchema.parse(genericFallbackRecap("cafe-order")).win)
      .toBeTruthy();
    expect(genericFallbackRecap("unknown").nextMission.scenarioId).toBe(
      "cafe-order",
    );
  });
});
