/**
 * Client-side Live server-message parsing (WS + duplex share this).
 */
import type { LiveBridgeEvent } from "@/lib/live/types";

export type LiveReadyPayload = {
  sessionId: string;
  practiceSessionId?: string;
  model?: string;
  scenarioId?: string;
  starterLine?: string;
  titleKo?: string;
  titleEn?: string;
};

export type ParsedLiveServerMessage =
  | ({ type: "ready" } & LiveReadyPayload)
  | { type: "error"; message: string }
  | LiveBridgeEvent
  | { type: "subscribed" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Parse one JSON Live server payload. Returns null if unusable. */
export function parseLiveServerMessage(
  raw: unknown,
): ParsedLiveServerMessage | null {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(data) || typeof data.type !== "string") return null;

  if (data.type === "ready") {
    if (typeof data.sessionId !== "string" || !data.sessionId) return null;
    return {
      type: "ready",
      sessionId: data.sessionId,
      practiceSessionId:
        typeof data.practiceSessionId === "string"
          ? data.practiceSessionId
          : undefined,
      model: typeof data.model === "string" ? data.model : undefined,
      scenarioId:
        typeof data.scenarioId === "string" ? data.scenarioId : undefined,
      starterLine:
        typeof data.starterLine === "string" ? data.starterLine : undefined,
      titleKo: typeof data.titleKo === "string" ? data.titleKo : undefined,
      titleEn: typeof data.titleEn === "string" ? data.titleEn : undefined,
    };
  }

  if (data.type === "error") {
    return {
      type: "error",
      message:
        typeof data.message === "string" ? data.message : "Live error",
    };
  }

  if (data.type === "subscribed") {
    return { type: "subscribed" };
  }

  // Bridge events — trust the server shape after type tag check.
  return data as LiveBridgeEvent;
}
