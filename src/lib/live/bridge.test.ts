import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendRealtimeInput = vi.fn();
const sendClientContent = vi.fn();
const close = vi.fn();

vi.mock("@/lib/gemini/client", () => ({
  createGenAIClient: () => ({
    live: {
      connect: vi.fn(async () => ({
        sendClientContent,
        sendRealtimeInput,
        close,
      })),
    },
  }),
}));

describe("live bridge", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendRealtimeInput.mockReset();
    sendClientContent.mockReset();
    close.mockReset();
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    const { __resetLiveBridgeForTests } = await import("@/lib/live/bridge");
    __resetLiveBridgeForTests();
  });

  afterEach(async () => {
    const { __resetLiveBridgeForTests } = await import("@/lib/live/bridge");
    __resetLiveBridgeForTests();
  });

  it("rejects unknown scenario ids", async () => {
    const { createLiveBridgeSession } = await import("@/lib/live/bridge");
    await expect(
      createLiveBridgeSession("user-1", "not-a-real-scenario"),
    ).rejects.toThrow(/Unknown scenario/);
  });

  it("enforces ownership on audio send", async () => {
    const {
      createLiveBridgeSession,
      sendLiveAudio,
    } = await import("@/lib/live/bridge");
    const { sessionId } = await createLiveBridgeSession("user-1", "daily-chat");
    expect(() => sendLiveAudio(sessionId, "AAAA", "user-2")).toThrow(
      /not found/,
    );
    sendLiveAudio(sessionId, "AAAA", "user-1");
    expect(sendRealtimeInput).toHaveBeenCalledOnce();
  });

  it("reaps idle sessions", async () => {
    const {
      createLiveBridgeSession,
      sendLiveAudio,
      reapStaleLiveSessions,
      __setLiveActivityForTests,
      LIVE_SESSION_TTL_MS,
    } = await import("@/lib/live/bridge");
    const { sessionId } = await createLiveBridgeSession("user-1", "daily-chat");
    __setLiveActivityForTests(
      sessionId,
      Date.now() - LIVE_SESSION_TTL_MS - 1_000,
    );
    reapStaleLiveSessions();
    expect(() => sendLiveAudio(sessionId, "AAAA", "user-1")).toThrow(
      /not found/,
    );
  });

  it("caps concurrent sessions per user", async () => {
    const {
      createLiveBridgeSession,
      sendLiveAudio,
    } = await import("@/lib/live/bridge");
    const a = await createLiveBridgeSession("user-1", "daily-chat");
    const b = await createLiveBridgeSession("user-1", "cafe-order");
    const c = await createLiveBridgeSession("user-1", "restaurant");
    // Oldest (a) should be gone; b + c remain.
    expect(() => sendLiveAudio(a.sessionId, "AAAA", "user-1")).toThrow(
      /not found/,
    );
    sendLiveAudio(b.sessionId, "AAAA", "user-1");
    sendLiveAudio(c.sessionId, "BBBB", "user-1");
    expect(sendRealtimeInput).toHaveBeenCalledTimes(2);
  });
});
