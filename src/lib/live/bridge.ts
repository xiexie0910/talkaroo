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
 * Vertex Live accepts 0–2000ms. Docs recommend ~500–800ms for ASR quality;
 * L2 learners pause mid-thought, so default slightly above that.
 * Raise via GEMINI_LIVE_SILENCE_MS if speech is still cut short.
 */
const SILENCE_DURATION_MS = (() => {
  const raw = Number(process.env.GEMINI_LIVE_SILENCE_MS?.trim() || "1100");
  if (!Number.isFinite(raw)) return 1100;
  return Math.min(2000, Math.max(200, raw));
})();

/**
 * Required speech duration before start-of-speech is committed.
 * Higher = fewer false starts from clicks / room noise.
 * Keep moderate so quiet speech and short replies ("네") still work.
 */
const PREFIX_PADDING_MS = (() => {
  const raw = Number(process.env.GEMINI_LIVE_PREFIX_PADDING_MS?.trim() || "200");
  if (!Number.isFinite(raw)) return 200;
  return Math.min(1000, Math.max(20, raw));
})();

/**
 * LOW = fewer ambient false starts (default).
 * Set GEMINI_LIVE_START_SENSITIVITY=high if quiet speech is missed.
 */
const START_OF_SPEECH =
  process.env.GEMINI_LIVE_START_SENSITIVITY?.trim().toLowerCase() === "high"
    ? StartSensitivity.START_SENSITIVITY_HIGH
    : StartSensitivity.START_SENSITIVITY_LOW;

/**
 * LOW = less eager end-of-speech (keeps mid-sentence pauses in one turn).
 * HIGH fragments utterances → weaker Live ASR. Override with
 * GEMINI_LIVE_END_SENSITIVITY=high for snappier barge-in.
 */
const END_OF_SPEECH =
  process.env.GEMINI_LIVE_END_SENSITIVITY?.trim().toLowerCase() === "high"
    ? EndSensitivity.END_SENSITIVITY_HIGH
    : EndSensitivity.END_SENSITIVITY_LOW;

/** Bias Live ASR toward common learner Korean (speech adaptation). */
const INPUT_ASR_ADAPTATION = [
  "안녕하세요",
  "네",
  "아니요",
  "주세요",
  "감사합니다",
  "아메리카노",
  "아이스 아메리카노",
  "한 잔",
  "얼마예요",
  "도와주세요",
] as const;

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

const LIVE_SESSIONS_KEY = Symbol.for("talkaroo.liveSessions.v1");
const LIVE_REAPER_KEY = Symbol.for("talkaroo.liveReaper.v1");

type LiveGlobals = typeof globalThis & {
  [LIVE_SESSIONS_KEY]?: Map<string, StoredSession>;
  [LIVE_REAPER_KEY]?: ReturnType<typeof setInterval>;
};

function liveGlobals(): LiveGlobals {
  return globalThis as LiveGlobals;
}

function sessions(): Map<string, StoredSession> {
  const g = liveGlobals();
  if (!g[LIVE_SESSIONS_KEY]) {
    g[LIVE_SESSIONS_KEY] = new Map();
  }
  return g[LIVE_SESSIONS_KEY]!;
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
  const g = liveGlobals();
  if (g[LIVE_REAPER_KEY]) return;
  g[LIVE_REAPER_KEY] = setInterval(() => reapStaleLiveSessions(), 60_000);
  // Don't keep the process alive solely for the reaper in Node.
  g[LIVE_REAPER_KEY].unref?.();
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
      // Prefer Korean; allow English so clear English isn't forced into Hangul.
      inputAudioTranscription: {
        languageHints: { languageCodes: ["ko-KR", "en-US"] },
        adaptationPhrases: [...INPUT_ASR_ADAPTATION],
      },
      outputAudioTranscription: {
        languageHints: { languageCodes: ["ko-KR"] },
      },
      // LOW start + LOW end: fewer noise starts, fewer mid-thought cutoffs
      // (fragmented turns hurt Live input transcription quality).
      realtimeInputConfig: {
        automaticActivityDetection: {
          startOfSpeechSensitivity: START_OF_SPEECH,
          endOfSpeechSensitivity: END_OF_SPEECH,
          prefixPaddingMs: PREFIX_PADDING_MS,
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
        // Low-latency caption while the learner is still speaking (full snapshot).
        if (sc.interimInputTranscription?.text) {
          emit(stored, {
            type: "input_transcription",
            text: sc.interimInputTranscription.text,
            mode: "replace",
          });
        }
        // Input transcription: unfinished = cumulative interim (replace).
        // finished/omitted: often a short delta, sometimes a cumulative final —
        // client mergeTranscriptChunk handles both.
        if (sc.inputTranscription?.text) {
          const finished = sc.inputTranscription.finished;
          const interim = finished === false;
          emit(stored, {
            type: "input_transcription",
            text: sc.inputTranscription.text,
            mode: interim ? "replace" : "append",
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
  const g = liveGlobals();
  if (g[LIVE_REAPER_KEY]) {
    clearInterval(g[LIVE_REAPER_KEY]);
    g[LIVE_REAPER_KEY] = undefined;
  }
}

export function __setLiveActivityForTests(sessionId: string, at: number) {
  const stored = sessions().get(sessionId);
  if (stored) stored.lastActivityAt = at;
}
