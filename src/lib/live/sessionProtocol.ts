/**
 * Shared Live session protocol for WebSocket + duplex stream routes.
 * Keeps create / audio / cleanup logic in one place.
 */
import type { RequireUserOk } from "@/lib/auth/requireUser";
import {
  createPracticeSession,
  endPracticeSession,
} from "@/lib/db/practice";
import {
  closeLiveBridge,
  createLiveBridgeSession,
  sendLiveAudio,
  subscribeLiveBridge,
} from "@/lib/live/bridge";
import type { LiveBridgeEvent } from "@/lib/live/types";
import { takeToken } from "@/lib/rateLimit";
import { getScenario, scenarioById } from "@/lib/scenarios";

export const LIVE_CREATE_LIMIT = 8;
export const LIVE_CREATE_WINDOW_MS = 60_000;
export const MAX_AUDIO_B64_CHARS = 64_000;
export const AUDIO_RATE_LIMIT = 120;
export const AUDIO_RATE_WINDOW_MS = 10_000;

export type LiveClientMessage =
  | { type: "start"; scenarioId?: string }
  | { type: "audio"; audio: string }
  | { type: "end" };

export type LiveReadyMessage = {
  type: "ready";
  sessionId: string;
  practiceSessionId: string;
  model: string;
  scenarioId: string;
  starterLine: string;
  titleKo: string;
  titleEn: string;
};

export type LiveServerMessage =
  | LiveReadyMessage
  | LiveBridgeEvent
  | { type: "error"; message: string };

export function parseLiveClientMessage(raw: unknown): LiveClientMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as Record<string, unknown>;
  if (msg.type === "end") return { type: "end" };
  if (msg.type === "start") {
    return {
      type: "start",
      scenarioId:
        typeof msg.scenarioId === "string" ? msg.scenarioId : undefined,
    };
  }
  if (msg.type === "audio" && typeof msg.audio === "string") {
    return { type: "audio", audio: msg.audio };
  }
  return null;
}

export type LiveSessionHooks = {
  send: (msg: LiveServerMessage) => void;
  logPrefix: string;
};

export type ActiveLiveSession = {
  liveSessionId: string | null;
  unsub: (() => void) | undefined;
};

/**
 * Start Vertex Live + practice row + event subscription.
 * Returns true if a session was started (or already started).
 */
export async function startLivePracticeSession(
  auth: RequireUserOk,
  scenarioIdRaw: string | undefined,
  hooks: LiveSessionHooks & {
    setSession: (sessionId: string, unsub: () => void) => void;
    onBridgeClosed: () => void;
  },
): Promise<"ok" | "rate_limited" | "bad_scenario" | "failed"> {
  if (
    !takeToken(
      `live-create:${auth.user.id}`,
      LIVE_CREATE_LIMIT,
      LIVE_CREATE_WINDOW_MS,
    )
  ) {
    hooks.send({
      type: "error",
      message: "Too many Live sessions — try again shortly",
    });
    return "rate_limited";
  }

  const scenarioId = scenarioIdRaw?.trim() || undefined;
  if (scenarioId && !scenarioById[scenarioId]) {
    hooks.send({ type: "error", message: "Unknown scenario" });
    return "bad_scenario";
  }

  let liveSessionId: string | null = null;
  try {
    const scenario = getScenario(scenarioId);
    const { sessionId, model } = await createLiveBridgeSession(
      auth.user.id,
      scenario.id,
    );
    liveSessionId = sessionId;

    const practiceSessionId = await createPracticeSession(auth.supabase, {
      userId: auth.user.id,
      liveSessionId: sessionId,
      scenarioId: scenario.id,
      titleKo: scenario.titleKo,
      titleEn: scenario.titleEn,
    });

    const unsub = subscribeLiveBridge(
      sessionId,
      (event) => {
        hooks.send(event);
        if (event.type === "closed") hooks.onBridgeClosed();
      },
      auth.user.id,
    );

    hooks.setSession(sessionId, unsub);
    hooks.send({
      type: "ready",
      sessionId,
      practiceSessionId,
      model,
      scenarioId: scenario.id,
      starterLine: scenario.starterLine,
      titleKo: scenario.titleKo,
      titleEn: scenario.titleEn,
    });
    return "ok";
  } catch (err) {
    console.error(`${hooks.logPrefix} start`, err);
    if (liveSessionId) {
      closeLiveBridge(liveSessionId, auth.user.id);
    }
    hooks.send({ type: "error", message: "Failed to start Live session" });
    return "failed";
  }
}

/** Forward a validated audio chunk into the in-memory Live bridge. */
export function forwardLiveAudio(
  auth: RequireUserOk,
  liveSessionId: string | null,
  audio: string,
  send: (msg: LiveServerMessage) => void,
): void {
  if (!liveSessionId) return;
  if (!audio || audio.length > MAX_AUDIO_B64_CHARS) return;
  if (!/^[A-Za-z0-9+/]+=*$/.test(audio)) return;
  if (
    !takeToken(
      `live-audio:${auth.user.id}:${liveSessionId}`,
      AUDIO_RATE_LIMIT,
      AUDIO_RATE_WINDOW_MS,
    )
  ) {
    return;
  }
  try {
    sendLiveAudio(liveSessionId, audio, auth.user.id);
  } catch {
    send({ type: "error", message: "Live session not found" });
  }
}

/** Close bridge + end practice row. Safe to call multiple times. */
export async function cleanupLivePracticeSession(
  auth: RequireUserOk,
  liveSessionId: string | null,
  unsub: (() => void) | undefined,
  logPrefix: string,
): Promise<void> {
  unsub?.();
  if (!liveSessionId) return;
  closeLiveBridge(liveSessionId, auth.user.id);
  try {
    await endPracticeSession(auth.supabase, {
      userId: auth.user.id,
      liveSessionId,
    });
  } catch (err) {
    console.error(`${logPrefix} end practice`, err);
  }
}
