import { describe, expect, it } from "vitest";
import {
  hasHangul,
  isCoachableLearnerTranscript,
  isDisplayableLearnerTranscript,
  isNearDuplicateUtterance,
  isTranscriptContinuation,
  mergeTranscriptChunk,
  sanitizeLearnerTranscript,
} from "@/lib/session/transcript";

describe("hasHangul", () => {
  it("detects Korean syllables", () => {
    expect(hasHangul("일 하다가.")).toBe(true);
    expect(hasHangul("hello 안녕")).toBe(true);
  });

  it("rejects latin / ASR garbage", () => {
    expect(hasHangul("{Rolle} {Rolle} X")).toBe(false);
    expect(hasHangul("ok")).toBe(false);
  });
});

describe("sanitizeLearnerTranscript", () => {
  it("strips brace / bracket ASR tags", () => {
    expect(sanitizeLearnerTranscript("{Rolle} {Rolle} X")).toBe("X");
    expect(sanitizeLearnerTranscript("{} 음")).toBe("음");
    expect(sanitizeLearnerTranscript("안녕 {Role}")).toBe("안녕");
    expect(sanitizeLearnerTranscript("[music] 오늘")).toBe("오늘");
  });

  it("collapses leftover junk symbols", () => {
    expect(sanitizeLearnerTranscript("{ } |||")).toBe("");
  });
});

describe("isDisplayableLearnerTranscript", () => {
  it("accepts Hangul after cleanup", () => {
    expect(isDisplayableLearnerTranscript("오늘 뭐 했어?")).toBe(true);
    expect(isDisplayableLearnerTranscript("{Rolle} 응")).toBe(true);
  });

  it("rejects empty and non-Korean ASR noise", () => {
    expect(isDisplayableLearnerTranscript("")).toBe(false);
    expect(isDisplayableLearnerTranscript("{}")).toBe(false);
    expect(isDisplayableLearnerTranscript("{Rolle} {Rolle} X")).toBe(false);
    expect(isDisplayableLearnerTranscript("ok")).toBe(false);
  });
});

describe("isCoachableLearnerTranscript", () => {
  it("accepts short Hangul", () => {
    expect(isCoachableLearnerTranscript("일 하다가.")).toBe(true);
  });

  it("rejects empty and non-Korean ASR noise", () => {
    expect(isCoachableLearnerTranscript("")).toBe(false);
    expect(isCoachableLearnerTranscript("   ")).toBe(false);
    expect(isCoachableLearnerTranscript("{Rolle} {Rolle} X")).toBe(false);
  });
});

describe("isNearDuplicateUtterance", () => {
  it("detects repeated learner lines", () => {
    expect(isNearDuplicateUtterance("없어요", "없어요")).toBe(true);
    expect(isNearDuplicateUtterance("없어요.", "없어요")).toBe(true);
    expect(isNearDuplicateUtterance("았어요", "없어요")).toBe(false);
  });

  it("detects partial ASR of the same short line", () => {
    expect(isNearDuplicateUtterance("없어요", "요")).toBe(false);
    expect(isNearDuplicateUtterance("없어요", "없어요요")).toBe(true);
  });
});

describe("isTranscriptContinuation", () => {
  it("detects cumulative partner lines after an early seal", () => {
    expect(
      isTranscriptContinuation("어, 왔어!", "어, 왔어! 주말인데 뭐했어?"),
    ).toBe(true);
  });

  it("rejects unrelated next lines", () => {
    expect(isTranscriptContinuation("어, 왔어!", "오늘 날씨 좋다")).toBe(
      false,
    );
  });
});

describe("mergeTranscriptChunk", () => {
  it("replaces on interim snapshots", () => {
    expect(mergeTranscriptChunk("안", "안녕", "replace")).toBe("안녕");
  });

  it("appends deltas and upgrades cumulative chunks", () => {
    expect(mergeTranscriptChunk("안녕", "하세요", "append")).toBe("안녕하세요");
    expect(mergeTranscriptChunk("안녕", "안녕하세요", "append")).toBe(
      "안녕하세요",
    );
  });
});
