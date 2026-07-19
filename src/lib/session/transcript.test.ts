import { describe, expect, it } from "vitest";
import {
  hasHangul,
  isCoachableLearnerTranscript,
  mergeTranscriptChunk,
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
