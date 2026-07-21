import { describe, expect, it } from "vitest";
import { parseLiveServerMessage } from "@/lib/live/clientMessages";
import { parseLiveClientMessage } from "@/lib/live/sessionProtocol";

describe("parseLiveServerMessage", () => {
  it("parses ready payloads", () => {
    const msg = parseLiveServerMessage({
      type: "ready",
      sessionId: "live_1",
      practiceSessionId: "p1",
    });
    expect(msg).toEqual({
      type: "ready",
      sessionId: "live_1",
      practiceSessionId: "p1",
      model: undefined,
      scenarioId: undefined,
      starterLine: undefined,
      titleKo: undefined,
      titleEn: undefined,
    });
  });

  it("rejects ready without sessionId", () => {
    expect(parseLiveServerMessage({ type: "ready" })).toBeNull();
  });

  it("parses error messages", () => {
    expect(parseLiveServerMessage({ type: "error", message: "nope" })).toEqual({
      type: "error",
      message: "nope",
    });
  });

  it("parses JSON strings", () => {
    expect(
      parseLiveServerMessage(JSON.stringify({ type: "open" })),
    ).toEqual({ type: "open" });
  });
});

describe("parseLiveClientMessage", () => {
  it("parses start / audio / end", () => {
    expect(parseLiveClientMessage({ type: "start", scenarioId: "daily-chat" })).toEqual({
      type: "start",
      scenarioId: "daily-chat",
    });
    expect(parseLiveClientMessage({ type: "audio", audio: "AAAA" })).toEqual({
      type: "audio",
      audio: "AAAA",
    });
    expect(parseLiveClientMessage({ type: "end" })).toEqual({ type: "end" });
  });

  it("rejects garbage", () => {
    expect(parseLiveClientMessage(null)).toBeNull();
    expect(parseLiveClientMessage({ type: "audio" })).toBeNull();
  });
});
