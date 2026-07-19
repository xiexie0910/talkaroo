import { afterEach, describe, expect, it, vi } from "vitest";

const mockGenerateContent = vi.fn();
const mockGetPracticeSessionForUser = vi.fn();
const mockGetSessionSummary = vi.fn();
const mockSaveSessionSummary = vi.fn();
const mockEndPracticeSession = vi.fn();

vi.mock("@/lib/gemini/client", () => ({
  createGenAIClient: () => ({
    models: { generateContent: mockGenerateContent },
  }),
}));

vi.mock("@/lib/auth/requireUser", () => ({
  isRequireUserError: (result: { error?: unknown }) => "error" in result,
  requireUser: vi.fn(async () => ({
    user: { id: "user-test", email: "test@example.com" },
    supabase: {},
  })),
}));

vi.mock("@/lib/db/practice", () => ({
  getPracticeSessionForUser: (...args: unknown[]) =>
    mockGetPracticeSessionForUser(...args),
  getSessionSummary: (...args: unknown[]) => mockGetSessionSummary(...args),
  saveSessionSummary: (...args: unknown[]) => mockSaveSessionSummary(...args),
  endPracticeSession: (...args: unknown[]) => mockEndPracticeSession(...args),
}));

const validRecap = {
  win: "You successfully ordered a drink and answered a follow-up.",
  focus: {
    korean: "아이스 라테로 주세요",
    english: "An iced latte, please.",
    reason: "Clear drink order.",
  },
  nextMission: {
    scenarioId: "cafe-order",
    objective: "At the café, ask for an iced drink and say whether it is to go.",
    starterPhrase: "아이스 라테로 주세요",
  },
};

describe("POST /api/practice/sessions/[id]/complete", () => {
  afterEach(() => {
    vi.resetModules();
    mockGenerateContent.mockReset();
    mockGetPracticeSessionForUser.mockReset();
    mockGetSessionSummary.mockReset();
    mockSaveSessionSummary.mockReset();
    mockEndPracticeSession.mockReset();
    delete process.env.GOOGLE_CLOUD_PROJECT;
  });

  it("returns generated recap and ends the session", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    mockGetPracticeSessionForUser.mockResolvedValue({
      id: "ps-1",
      scenario_id: "cafe-order",
      status: "active",
    });
    mockGetSessionSummary.mockResolvedValue(null);
    mockSaveSessionSummary.mockResolvedValue({
      practice_session_id: "ps-1",
      recap: validRecap,
      next_scenario_id: "cafe-order",
    });
    mockEndPracticeSession.mockResolvedValue(undefined);
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(validRecap),
    });

    const { POST } = await import(
      "@/app/api/practice/sessions/[id]/complete/route"
    );
    const res = await POST(
      new Request("http://localhost/api/practice/sessions/ps-1/complete", {
        method: "POST",
        body: JSON.stringify({
          transcript: [
            { role: "partner", text: "주문하시겠어요?" },
            { role: "user", text: "커피 주세요" },
            { role: "partner", text: "핫으로 할까요?" },
            { role: "user", text: "아이스로요" },
            { role: "user", text: "테이크아웃이요" },
            { role: "user", text: "감사합니다" },
          ],
        }),
      }),
      { params: Promise.resolve({ id: "ps-1" }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recap.focus.korean).toContain("라테");
    expect(json.fallback).toBeUndefined();
    expect(mockSaveSessionSummary).toHaveBeenCalled();
    expect(mockEndPracticeSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ practiceSessionId: "ps-1" }),
    );
  });

  it("is idempotent when a summary already exists", async () => {
    mockGetPracticeSessionForUser.mockResolvedValue({
      id: "ps-1",
      scenario_id: "cafe-order",
      status: "ended",
    });
    mockGetSessionSummary.mockResolvedValue({
      practice_session_id: "ps-1",
      recap: validRecap,
      next_scenario_id: "cafe-order",
    });

    const { POST } = await import(
      "@/app/api/practice/sessions/[id]/complete/route"
    );
    const res = await POST(
      new Request("http://localhost/api/practice/sessions/ps-1/complete", {
        method: "POST",
        body: JSON.stringify({ transcript: [] }),
      }),
      { params: Promise.resolve({ id: "ps-1" }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recap.win).toContain("ordered");
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockSaveSessionSummary).not.toHaveBeenCalled();
  });

  it("returns fallback recap when generation fails", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "test-project";
    mockGetPracticeSessionForUser.mockResolvedValue({
      id: "ps-1",
      scenario_id: "daily-chat",
      status: "active",
    });
    mockGetSessionSummary.mockResolvedValue(null);
    mockSaveSessionSummary.mockResolvedValue({});
    mockEndPracticeSession.mockResolvedValue(undefined);
    mockGenerateContent.mockRejectedValue(new Error("boom"));

    const { POST } = await import(
      "@/app/api/practice/sessions/[id]/complete/route"
    );
    const res = await POST(
      new Request("http://localhost/api/practice/sessions/ps-1/complete", {
        method: "POST",
        body: JSON.stringify({
          transcript: [{ role: "user", text: "안녕하세요" }],
        }),
      }),
      { params: Promise.resolve({ id: "ps-1" }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fallback).toBe(true);
    expect(json.recap.nextMission.scenarioId).toBe("daily-chat");
    expect(mockEndPracticeSession).toHaveBeenCalled();
  });

  it("returns 404 when session is missing", async () => {
    mockGetPracticeSessionForUser.mockResolvedValue(null);

    const { POST } = await import(
      "@/app/api/practice/sessions/[id]/complete/route"
    );
    const res = await POST(
      new Request("http://localhost/api/practice/sessions/missing/complete", {
        method: "POST",
        body: JSON.stringify({ transcript: [] }),
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(res.status).toBe(404);
  });
});
