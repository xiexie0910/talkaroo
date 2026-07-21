import { describe, expect, it } from "vitest";
import {
  fixtureLearnerContextFix,
  fixtureLearnerGarbage,
  fixtureLearnerImprove,
  fixtureLearnerNatural,
  fixturePartnerAssist,
} from "@/lib/coach/fixtures";
import {
  normalizeCoachPayload,
  parseCoachResponse,
  safeParseCoachResponse,
} from "@/lib/coach/schema";

describe("coach schema", () => {
  it("accepts partner_assist fixture", () => {
    const parsed = parseCoachResponse(fixturePartnerAssist);
    expect(parsed.mode).toBe("partner_assist");
    if (parsed.mode === "partner_assist") {
      expect(parsed.vocab.length).toBeGreaterThan(0);
      expect(parsed.suggested_replies.length).toBeGreaterThan(0);
    }
  });

  it("accepts learner_improve fixture", () => {
    const parsed = parseCoachResponse(fixtureLearnerImprove);
    expect(parsed.mode).toBe("learner_improve");
    if (parsed.mode === "learner_improve") {
      expect(parsed.heard_as_ko).toContain("김치");
      expect(parsed.meant_en.length).toBeGreaterThan(0);
      expect(parsed.natural_ko).toContain("김치");
      expect(parsed.tips_en.length).toBeGreaterThan(0);
      expect(parsed.formality).toBe("haeyo");
      expect(parsed.was_already_natural).toBe(false);
    }
  });

  it("accepts context/ASR fix fixture", () => {
    const parsed = parseCoachResponse(fixtureLearnerContextFix);
    expect(parsed.mode).toBe("learner_improve");
    if (parsed.mode === "learner_improve") {
      expect(parsed.meant_en.toLowerCase()).not.toContain("daegu");
      expect(parsed.natural_ko).toContain("되게");
      expect(parsed.tips_en.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("accepts already-natural learner fixture", () => {
    const parsed = parseCoachResponse(fixtureLearnerNatural);
    expect(parsed.mode).toBe("learner_improve");
    if (parsed.mode === "learner_improve") {
      expect(parsed.was_already_natural).toBe(true);
    }
  });

  it("accepts learner garbage fixture", () => {
    const parsed = parseCoachResponse(fixtureLearnerGarbage);
    expect(parsed.mode).toBe("learner_improve");
    if (parsed.mode === "learner_improve") {
      expect(parsed.natural_ko).toBe("");
    }
  });

  it("clamps oversized tips_en before parse", () => {
    const longTip = "x".repeat(260);
    const result = safeParseCoachResponse(
      normalizeCoachPayload({
        mode: "learner_improve",
        user_sentence: "없어요.",
        heard_as_ko: "없어요.",
        meant_en: "I don't have any.",
        natural_ko: "없어요.",
        natural_en: "I don't have any.",
        formality: "haeyo",
        formality_fit: "fits",
        tips_en: [longTip],
        was_already_natural: true,
      }),
    );
    expect(result.success).toBe(true);
    if (result.success && result.data.mode === "learner_improve") {
      expect(result.data.tips_en[0]!.length).toBeLessThanOrEqual(200);
    }
  });

  it("rejects malformed JSON shape", () => {
    const result = safeParseCoachResponse({ mode: "partner_assist" });
    expect(result.success).toBe(false);
  });

  it("rejects wrong mode payload", () => {
    const result = safeParseCoachResponse({
      mode: "learner_improve",
      partner_sentence: "안녕하세요",
      vocab: [],
      suggested_replies: [],
    });
    expect(result.success).toBe(false);
  });

  it("strips empty optional notes", () => {
    const parsed = parseCoachResponse({
      mode: "partner_assist",
      partner_sentence: "안녕하세요!",
      translation_en: "Hello!",
      vocab: [{ surface: "안녕", meaning_en: "hello", note: "" }],
      suggested_replies: [
        { ko: "안녕하세요.", en: "Hello.", pattern: "" },
      ],
    });
    expect(parsed.mode).toBe("partner_assist");
    if (parsed.mode === "partner_assist") {
      expect(parsed.vocab[0]?.note).toBeUndefined();
      expect(parsed.suggested_replies[0]?.pattern).toBeUndefined();
    }
  });
});
