import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendRealtimeInput = vi.fn();
const sendClientContent = vi.fn();
const close = vi.fn();
const createPracticeSession = vi.fn().mockResolvedValue("practice-1");
const endPracticeSession = vi.fn().mockResolvedValue(undefined);

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

vi.mock("@/lib/auth/requireUser", () => ({
  requireUser: vi.fn(async () => ({
    user: { id: "user-1", email: "a@b.com" },
    supabase: {},
  })),
  isRequireUserError: () => false,
}));

vi.mock("@/lib/db/practice", () => ({
  createPracticeSession: (input: unknown) => createPracticeSession(input),
  endPracticeSession: (input: unknown) => endPracticeSession(input),
}));

describe("POST /api/live/stream", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendRealtimeInput.mockReset();
    sendClientContent.mockReset();
    close.mockReset();
    createPracticeSession.mockClear().mockResolvedValue("practice-1");
    endPracticeSession.mockClear().mockResolvedValue(undefined);
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    const { __resetLiveBridgeForTests } = await import("@/lib/live/bridge");
    __resetLiveBridgeForTests();
  });

  afterEach(async () => {
    const { __resetLiveBridgeForTests } = await import("@/lib/live/bridge");
    __resetLiveBridgeForTests();
  });

  it("creates a session, accepts audio on the same request, then ends", async () => {
    const { POST } = await import("@/app/api/live/stream/route");
    const { sendLiveAudio } = await import("@/lib/live/bridge");

    const encoder = new TextEncoder();
    let uplinkController!: ReadableStreamDefaultController<Uint8Array>;
    const uplink = new ReadableStream<Uint8Array>({
      start(c) {
        uplinkController = c;
      },
    });

    const req = new Request("http://localhost/api/live/stream", {
      method: "POST",
      body: uplink,
      // @ts-expect-error duplex for Node fetch/Request
      duplex: "half",
      signal: AbortSignal.timeout(15_000),
    });

    const resPromise = POST(req);
    await new Promise((r) => setTimeout(r, 20));

    uplinkController.enqueue(
      encoder.encode(
        `${JSON.stringify({ type: "start", scenarioId: "daily-chat" })}\n`,
      ),
    );

    const res = await resPromise;
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sessionId = "";

    for (let i = 0; i < 40 && !sessionId; i++) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6)) as {
            type: string;
            sessionId?: string;
            message?: string;
          };
          if (data.type === "ready" && data.sessionId) {
            sessionId = data.sessionId;
          }
          if (data.type === "error") {
            throw new Error(data.message ?? "stream error");
          }
        }
      }
    }

    expect(sessionId).toBeTruthy();
    expect(createPracticeSession).toHaveBeenCalledOnce();

    uplinkController.enqueue(
      encoder.encode(`${JSON.stringify({ type: "audio", audio: "AAAA" })}\n`),
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(sendRealtimeInput).toHaveBeenCalled();

    sendLiveAudio(sessionId, "BBBB", "user-1");
    expect(sendRealtimeInput).toHaveBeenCalledTimes(2);

    uplinkController.enqueue(
      encoder.encode(`${JSON.stringify({ type: "end" })}\n`),
    );
    uplinkController.close();
    await new Promise((r) => setTimeout(r, 30));
    expect(endPracticeSession).toHaveBeenCalled();
  });
});
