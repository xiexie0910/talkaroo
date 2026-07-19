/**
 * In-process Vertex Live session bridge (single Node only — not multi-instance).
 */
import {
  EndSensitivity,
  Modality,
  StartSensitivity,
  type Session,
} from "@google/genai";
import { createGenAIClient } from "@/lib/gemini/client";
import type { LiveBridgeEvent } from "@/lib/live/types";
import { getScenario, LIVE_MODEL, scenarioById } from "@/lib/scenarios";

/**
 * How long silence before Live commits end-of-speech.
 * Vertex Live accepts 0–2000ms. Lower = snappier partner replies;
 * raise via GEMINI_LIVE_SILENCE_MS if learners get cut off mid-thought.
 */
const SILENCE_DURATION_MS = (() => {
  const raw = Number(process.env.GEMINI_LIVE_SILENCE_MS?.trim() || "900");
  if (!Number.isFinite(raw)) return 900;
  return Math.min(2000, Math.max(200, raw));
})();

/** Idle Live sockets are closed so abandoned tabs don't burn Vertex quota. */
const SESSION_TTL_MS = 30 * 60_000;
/** Soft cap per user on one Node process (multi-tab / reconnect storms). */
const MAX_SESSIONS_PER_USER = 2;

export type { LiveBridgeEvent };

type Subscriber = (event: LiveBridgeEvent) => void;

type StoredSession = {
  id: string;
  userId: string;
  scenarioId: string;
  session: Session;
  subscribers: Set<Subscriber>;
  createdAt: number;
  lastActivityAt: number;
};

const globalForLive = globalThis as unknown as {
  __talkarooLiveSessions?: Map<string, StoredSession>;
  __talkarooLiveReaper?: ReturnType<typeof setInterval>;
};

function sessions(): Map<string, StoredSession> {
  if (!globalForLive.__talkarooLiveSessions) {
    globalForLive.__talkarooLiveSessions = new Map();
  }
  return globalForLive.__talkarooLiveSessions;
}

function touch(stored: StoredSession) {
  stored.lastActivityAt = Date.now();
}

function forceClose(stored: StoredSession, reason: string) {
  try {
    emit(stored, { type: "error", message: reason });
    emit(stored, { type: "closed" });
    stored.session.close();
  } catch {
    /* already closed */
  }
  sessions().delete(stored.id);
}

/** Drop idle / abandoned Live sessions (single-process only). */
export function reapStaleLiveSessions(now = Date.now()) {
  for (const stored of sessions().values()) {
    if (now - stored.lastActivityAt > SESSION_TTL_MS) {
      forceClose(stored, "Live session timed out due to inactivity");
    }
  }
}

function ensureReaper() {
  if (globalForLive.__talkarooLiveReaper) return;
  globalForLive.__talkarooLiveReaper = setInterval(
    () => reapStaleLiveSessions(),
    60_000,
  );
  // Don't keep the process alive solely for the reaper in Node.
  globalForLive.__talkarooLiveReaper.unref?.();
}

function emit(stored: StoredSession, event: LiveBridgeEvent) {
  for (const sub of stored.subscribers) {
    try {
      sub(event);
    } catch (err) {
      console.error("[live-bridge] subscriber error", err);
    }
  }
}

function closeOldestForUser(userId: string) {
  const owned = [...sessions().values()]
    .filter((s) => s.userId === userId)
    .sort((a, b) => a.createdAt - b.createdAt);
  while (owned.length >= MAX_SESSIONS_PER_USER) {
    const oldest = owned.shift();
    if (!oldest) break;
    forceClose(oldest, "Replaced by a newer Live session");
  }
}

export async function createLiveBridgeSession(
  userId: string,
  scenarioId?: string,
): Promise<{
  sessionId: string;
  model: string;
  scenarioId: string;
}> {
  ensureReaper();
  reapStaleLiveSessions();

  if (scenarioId && !scenarioById[scenarioId]) {
    throw new Error("Unknown scenario");
  }

  closeOldestForUser(userId);

  const scenario = getScenario(scenarioId);
  const client = createGenAIClient();
  const id = `live_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const session = await client.live.connect({
    model: LIVE_MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: scenario.systemInstruction,
      // Bias ASR toward Korean — practice sessions are Hangul-first.
      inputAudioTranscription: {
        languageHints: { languageCodes: ["ko-KR"] },
      },
      outputAudioTranscription: {
        languageHints: { languageCodes: ["ko-KR"] },
      },
      // Responsive VAD (Gemini Live defaults lean HIGH). Silence window still
      // gives a short think-pause without waiting the full 2s Vertex max.
      realtimeInputConfig: {
        automaticActivityDetection: {
          startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
          endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
          prefixPaddingMs: 20,
          silenceDurationMs: SILENCE_DURATION_MS,
        },
      },
      tools: [],
    },
    callbacks: {
      onopen: () => {
        const stored = sessions().get(id);
        if (stored) emit(stored, { type: "open" });
      },
      onmessage: (message) => {
        const stored = sessions().get(id);
        if (!stored) return;
        touch(stored);
        const sc = message.serverContent;
        if (!sc) return;

        // Barge-in: stop local playback before any further audio/transcript.
        if (sc.interrupted) {
          emit(stored, { type: "interrupted" });
        }
        for (const part of sc.modelTurn?.parts ?? []) {
          if (part.inlineData?.data) {
            emit(stored, { type: "audio", data: part.inlineData.data });
          }
        }
        if (sc.outputTranscription?.text) {
          emit(stored, {
            type: "output_transcription",
            text: sc.outputTranscription.text,
          });
        }
        // Interim ASR while the learner is still speaking (full snapshot).
        if (sc.interimInputTranscription?.text) {
          emit(stored, {
            type: "input_transcription",
            text: sc.interimInputTranscription.text,
            mode: "replace",
          });
        }
        // Committed input transcription chunks (usually deltas).
        if (sc.inputTranscription?.text) {
          emit(stored, {
            type: "input_transcription",
            text: sc.inputTranscription.text,
            mode: "append",
          });
        }
        if (sc.turnComplete) {
          emit(stored, { type: "turn_complete" });
        }
      },
      onerror: (e) => {
        const stored = sessions().get(id);
        if (stored) {
          emit(stored, { type: "error", message: e.message || "Live error" });
        }
      },
      onclose: () => {
        const stored = sessions().get(id);
        if (stored) {
          emit(stored, { type: "closed" });
          sessions().delete(id);
        }
      },
    },
  });

  const now = Date.now();
  sessions().set(id, {
    id,
    userId,
    scenarioId: scenario.id,
    session,
    subscribers: new Set(),
    createdAt: now,
    lastActivityAt: now,
  });

  // Kick off greeting for the selected scenario
  session.sendClientContent({
    turns: [
      {
        role: "user",
        parts: [{ text: scenario.kickoff }],
      },
    ],
    turnComplete: true,
  });

  return { sessionId: id, model: LIVE_MODEL, scenarioId: scenario.id };
}

export function subscribeLiveBridge(
  sessionId: string,
  subscriber: Subscriber,
  userId?: string,
): () => void {
  reapStaleLiveSessions();
  const stored = sessions().get(sessionId);
  if (!stored) {
    throw new Error("Live session not found");
  }
  if (userId && stored.userId !== userId) {
    throw new Error("Live session not found");
  }
  touch(stored);
  stored.subscribers.add(subscriber);
  return () => {
    stored.subscribers.delete(subscriber);
  };
}

export function sendLiveAudio(
  sessionId: string,
  base64Pcm: string,
  userId?: string,
) {
  const stored = sessions().get(sessionId);
  if (!stored) {
    throw new Error("Live session not found");
  }
  if (userId && stored.userId !== userId) {
    throw new Error("Live session not found");
  }
  touch(stored);
  stored.session.sendRealtimeInput({
    audio: { data: base64Pcm, mimeType: "audio/pcm;rate=16000" },
  });
}

export function closeLiveBridge(sessionId: string, userId?: string) {
  const stored = sessions().get(sessionId);
  if (!stored) return;
  if (userId && stored.userId !== userId) return;
  try {
    stored.session.close();
  } catch {
    /* ignore */
  }
  sessions().delete(sessionId);
}

/** Idle TTL — exported for tests. */
export const LIVE_SESSION_TTL_MS = SESSION_TTL_MS;

/** Test helpers — clear process-local Live state between cases. */
export function __resetLiveBridgeForTests() {
  for (const stored of sessions().values()) {
    try {
      stored.session.close();
    } catch {
      /* ignore */
    }
  }
  sessions().clear();
  if (globalForLive.__talkarooLiveReaper) {
    clearInterval(globalForLive.__talkarooLiveReaper);
    globalForLive.__talkarooLiveReaper = undefined;
  }
}

export function __setLiveActivityForTests(sessionId: string, at: number) {
  const stored = sessions().get(sessionId);
  if (stored) stored.lastActivityAt = at;
}
