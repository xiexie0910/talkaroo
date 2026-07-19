import { afterEach, describe, expect, it, vi } from "vitest";

const mockGenerateContent = vi.fn();

vi.mock("@/lib/gemini/client", () => ({
  createGenAIClient: () => ({
    models: { generateContent: mockGenerateContent },
  }),
}));

vi.mock("@/lib/auth/requireUser", () => ({
  isRequireUserError: (result: { error?: unknown }) => "error" in result,
  requireUser: vi.fn(async () => ({
    user: { id: "user-test", email: "test@example.com" },
    supabase: {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: "turn-1" }, error: null }),
          }),
        }),
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "ps-1" }, error: null }),
            }),
          }),
        }),
      }),
    },
  })),
}));

vi.mock("@/lib/db/practice", () => ({
  persistCoachTurn: vi.fn(async () => undefined),
}));

describe("POST /api/coach", () => {
  afterEach(() => {
    vi.resetModules();
    mockGenerateContent.mockReset();
    delete process.env.GOOGLE_CLOUD_PROJECT;
  });

  it("returns partner_assist JSON on happy path", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        mode: "partner_assist",
        partner_sentence: "오늘 하루 어땠어요?",
        translation_en: "How was your day today?",
        vocab: [
          { surface: "하루", meaning_en: "day", note: "" },
          { surface: "어땠어요", meaning_en: "how was it?", note: "question" },
        ],
        suggested_replies: [
          {
            ko: "조금 바빴어요.",
            en: "I was a bit busy.",
            pattern: "I was busy…",
          },
        ],
      }),
    });

    const { POST } = await import("@/app/api/coach/route");
    const res = await POST(
      new Request("http://localhost/api/coach", {
        method: "POST",
        body: JSON.stringify({
          mode: "partner_assist",
          level: "beginner",
          transcript: "오늘 하루 어땠어요?",
          turnId: "t1",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("partner_assist");
    expect(json.translation_en).toBe("How was your day today?");
    expect(json.vocab[0].surface).toBe("하루");
    expect(json.suggested_replies[0].pattern).toBe("I was busy…");
    expect(json.error).toBeUndefined();
  });

  it("returns learner_improve JSON on happy path", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        mode: "learner_improve",
        user_sentence: "오늘 김치 먹었어요",
        natural_ko: "오늘 김치를 먹었어요.",
        tip_en: "Add object particle 를.",
        was_already_natural: false,
      }),
    });

    const { POST } = await import("@/app/api/coach/route");
    const res = await POST(
      new Request("http://localhost/api/coach", {
        method: "POST",
        body: JSON.stringify({
          mode: "learner_improve",
          level: "beginner",
          transcript: "오늘 김치 먹었어요",
          context: "오늘 뭐 했어요?",
          turnId: "t2",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("learner_improve");
    expect(json.natural_ko).toContain("김치");
  });

  it("returns soft empty learner payload when transcript missing", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    const { POST } = await import("@/app/api/coach/route");
    const res = await POST(
      new Request("http://localhost/api/coach", {
        method: "POST",
        body: JSON.stringify({
          mode: "learner_improve",
          level: "beginner",
          transcript: "  ",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("learner_improve");
    expect(json.natural_ko).toBe("");
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("rejects invalid mode", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    const { POST } = await import("@/app/api/coach/route");
    const res = await POST(
      new Request("http://localhost/api/coach", {
        method: "POST",
        body: JSON.stringify({
          mode: "grammar",
          level: "beginner",
          transcript: "안녕",
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("retries then returns error payload", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    mockGenerateContent.mockResolvedValue({ text: "not-json{{{" });

    const { POST } = await import("@/app/api/coach/route");
    const res = await POST(
      new Request("http://localhost/api/coach", {
        method: "POST",
        body: JSON.stringify({
          mode: "learner_improve",
          level: "beginner",
          transcript: "안녕하세요",
          turnId: "t3",
        }),
      }),
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe(true);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it("rejects when GOOGLE_CLOUD_PROJECT missing", async () => {
    const { POST } = await import("@/app/api/coach/route");
    const res = await POST(
      new Request("http://localhost/api/coach", {
        method: "POST",
        body: JSON.stringify({
          mode: "partner_assist",
          level: "beginner",
          transcript: "안녕",
          turnId: "t4",
        }),
      }),
    );
    expect(res.status).toBe(500);
  });

  it("forbids polish at advanced level", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    const { POST } = await import("@/app/api/coach/route");
    const res = await POST(
      new Request("http://localhost/api/coach", {
        method: "POST",
        body: JSON.stringify({
          mode: "learner_improve",
          level: "advanced",
          transcript: "안녕하세요",
        }),
      }),
    );
    expect(res.status).toBe(403);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});
