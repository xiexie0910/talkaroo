"use client";

/**
 * Practice session UI + Live voice wiring.
 *
 * Flow: pick scenario/level → Start → mic streams to /api/live →
 * transcripts land in PartnerPane → coach cards attach under turns.
 *
 * Level only gates on-tap coaching (see lib/session/level.ts),
 * not the partner’s system prompt. No auto coach after turns.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { PartnerPane, type ChatMessage } from "@/components/PartnerPane";
import { ScenarioSidebar } from "@/components/ScenarioSidebar";
import type {
  CoachApiResult,
  CoachMode,
  CoachResponse,
} from "@/lib/coach/schema";
import { startMicCapture, type MicCapture } from "@/lib/live/micCapture";
import { createPcmPlayer, type PcmPlayer } from "@/lib/live/pcmPlayer";
import type { LiveBridgeEvent } from "@/lib/live/types";
import {
  getScenario,
  type LearnerLevel,
  type Scenario,
} from "@/lib/scenarios";
import { coachAffordance, shouldRunCoach } from "@/lib/session/level";
import { msgId, patchMessage } from "@/lib/session/messages";
import {
  isCoachableLearnerTranscript,
  mergeTranscriptChunk,
} from "@/lib/session/transcript";
import type { ConnectionStatus } from "@/lib/session/types";
import {
  createTurnId,
  shouldApplyCoachResult,
} from "@/lib/session/turnId";

/** Extra client grace after Live turn_complete before sealing a user turn. */
const USER_TURN_GRACE_MS = 1800;

type LastCoachRequest = {
  mode: CoachMode;
  transcript: string;
  context?: string;
  messageId: string;
};

export function SessionClient() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textFallback, setTextFallback] = useState("");
  const [scenario, setScenario] = useState<Scenario>(() => getScenario());
  const [level, setLevel] = useState<LearnerLevel>("beginner");

  // Refs keep latest values inside SSE / audio callbacks without re-subscribing
  const sessionIdRef = useRef<string | null>(null);
  const practiceSessionIdRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentTurnIdRef = useRef<string | null>(null);
  const coachAbortRef = useRef<AbortController | null>(null);
  const lastCoachRef = useRef<LastCoachRequest | null>(null);
  const lastPartnerLineRef = useRef("");
  const playerRef = useRef<PcmPlayer | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const intentionalCloseRef = useRef(false);
  const partnerBufRef = useRef("");
  const userBufRef = useRef("");
  const partnerMsgIdRef = useRef<string | null>(null);
  const userMsgIdRef = useRef<string | null>(null);
  const userTurnFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const scenarioRef = useRef<Scenario>(scenario);
  const levelRef = useRef<LearnerLevel>(level);

  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  const upsertStreaming = useCallback(
    (role: "partner" | "user", text: string, idRef: { current: string | null }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setMessages((prev) => {
        const id = idRef.current;
        if (id) {
          const idx = prev.findIndex((m) => m.id === id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], text: trimmed, pending: true };
            return next;
          }
        }
        const newId = msgId(role);
        idRef.current = newId;
        return [...prev, { id: newId, role, text: trimmed, pending: true }];
      });
    },
    [],
  );

  const finalizeStreaming = useCallback(
    (role: "partner" | "user", idRef: { current: string | null }) => {
      const id = idRef.current;
      if (!id) return null;
      idRef.current = null;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, pending: false, text: m.text.trim() } : m,
        ),
      );
      return id;
    },
    [],
  );

  const runCoach = useCallback(
    async (
      mode: CoachMode,
      transcript: string,
      context: string | undefined,
      turnId: string,
      messageId: string,
    ) => {
      // Skip modes the current level does not use (e.g. advanced skips partner_assist)
      if (!shouldRunCoach(levelRef.current, mode)) return;

      const text = transcript.trim();
      if (!text) return;
      // Learner path: skip ASR garbage with no Hangul (e.g. "{Rolle} X")
      if (mode === "learner_improve" && !isCoachableLearnerTranscript(text)) {
        return;
      }

      coachAbortRef.current?.abort();
      const abort = new AbortController();
      coachAbortRef.current = abort;
      currentTurnIdRef.current = turnId;
      lastCoachRef.current = { mode, transcript: text, context, messageId };

      setMessages((prev) =>
        patchMessage(prev, messageId, {
          coachState: "annotating",
          coachError: null,
        }),
      );

      try {
        const res = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            level: levelRef.current,
            transcript: text,
            context,
            turnId,
            practiceSessionId: practiceSessionIdRef.current ?? undefined,
          }),
          signal: abort.signal,
        });
        const json = (await res.json()) as CoachApiResult;
        if (!shouldApplyCoachResult(currentTurnIdRef.current, turnId)) return;

        if ("error" in json && json.error) {
          setMessages((prev) =>
            patchMessage(prev, messageId, {
              coachState: "error",
              coachError: json.message,
            }),
          );
          return;
        }

        const data = json as CoachResponse;
        if (data.mode === "partner_assist") {
          setMessages((prev) =>
            patchMessage(prev, messageId, {
              coachState: "ready",
              partnerAssist: data,
              coachError: null,
            }),
          );
        } else {
          setMessages((prev) =>
            patchMessage(prev, messageId, {
              coachState: "ready",
              learnerImprove: data,
              coachError: null,
            }),
          );
        }
      } catch (err) {
        if (abort.signal.aborted) return;
        if (!shouldApplyCoachResult(currentTurnIdRef.current, turnId)) return;
        setMessages((prev) =>
          patchMessage(prev, messageId, {
            coachState: "error",
            coachError: err instanceof Error ? err.message : "Coach failed",
          }),
        );
      }
    },
    [],
  );

  const ensurePlayer = useCallback(() => {
    playerRef.current ??= createPcmPlayer();
    return playerRef.current;
  }, []);

  const flushPlayback = useCallback(() => {
    playerRef.current?.flush();
  }, []);

  const stopMic = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
  }, []);

  const playPcmChunk = useCallback(
    (base64: string) => {
      void ensurePlayer().playBase64(base64);
    },
    [ensurePlayer],
  );

  const startMic = useCallback(async (sessionId: string) => {
    stopMic();
    micRef.current = await startMicCapture({
      sessionId,
      isActive: () => sessionIdRef.current === sessionId,
    });
  }, [stopMic]);

  const cleanupSession = useCallback(() => {
    if (userTurnFlushTimerRef.current) {
      clearTimeout(userTurnFlushTimerRef.current);
      userTurnFlushTimerRef.current = null;
    }
    coachAbortRef.current?.abort();
    coachAbortRef.current = null;
    currentTurnIdRef.current = null;
    stopMic();
    playerRef.current?.dispose();
    playerRef.current = null;
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    practiceSessionIdRef.current = null;
    if (id) {
      void fetch(`/api/live/session/${id}`, { method: "DELETE" });
    }
  }, [stopMic]);

  const clearUserTurnFlushTimer = useCallback(() => {
    if (userTurnFlushTimerRef.current) {
      clearTimeout(userTurnFlushTimerRef.current);
      userTurnFlushTimerRef.current = null;
    }
  }, []);

  const sealPartnerTurn = useCallback(() => {
    const text = partnerBufRef.current.trim();
    partnerBufRef.current = "";
    const id = finalizeStreaming("partner", partnerMsgIdRef);
    return { text, messageId: id };
  }, [finalizeStreaming]);

  const sealUserTurn = useCallback(() => {
    const text = userBufRef.current.trim();
    userBufRef.current = "";
    const id = finalizeStreaming("user", userMsgIdRef);
    return { text, messageId: id };
  }, [finalizeStreaming]);

  /** Seal the learner bubble only — polish is on tap (beginner), never auto. */
  const flushUserTurn = useCallback(() => {
    clearUserTurnFlushTimer();
    sealUserTurn();
  }, [clearUserTurnFlushTimer, sealUserTurn]);

  const scheduleUserTurnFlush = useCallback(() => {
    clearUserTurnFlushTimer();
    if (!userBufRef.current.trim() && !userMsgIdRef.current) return;
    userTurnFlushTimerRef.current = setTimeout(() => {
      userTurnFlushTimerRef.current = null;
      flushUserTurn();
    }, USER_TURN_GRACE_MS);
  }, [clearUserTurnFlushTimer, flushUserTurn]);

  const handleBridgeEvent = useCallback(
    (event: LiveBridgeEvent | { type: "subscribed" }) => {
      if (event.type === "subscribed") return;
      if (event.type === "open") {
        setStatus("live");
        setStatusMessage(undefined);
        return;
      }
      if (event.type === "interrupted") {
        // Gemini Live barge-in: stop queued PCM or old + new turns overlap.
        flushPlayback();
        const sealed = sealPartnerTurn();
        if (sealed.text && sealed.messageId) {
          lastPartnerLineRef.current = sealed.text;
        }
        return;
      }
      if (event.type === "audio") {
        // Partner audio means the model took the turn — seal any pending user line.
        if (userBufRef.current.trim() || userMsgIdRef.current) {
          flushUserTurn();
        }
        void playPcmChunk(event.data);
        return;
      }
      if (event.type === "output_transcription") {
        if (userBufRef.current.trim() || userMsgIdRef.current) {
          flushUserTurn();
        }
        partnerBufRef.current = mergeTranscriptChunk(
          partnerBufRef.current,
          event.text,
          "append",
        );
        upsertStreaming("partner", partnerBufRef.current, partnerMsgIdRef);
        return;
      }
      if (event.type === "input_transcription") {
        // More learner audio — cancel grace so a think-pause can continue one bubble.
        clearUserTurnFlushTimer();
        if (!userBufRef.current) {
          flushPlayback();
          const sealed = sealPartnerTurn();
          if (sealed.text && sealed.messageId) {
            lastPartnerLineRef.current = sealed.text;
          }
        }
        userBufRef.current = mergeTranscriptChunk(
          userBufRef.current,
          event.text,
          event.mode,
        );
        upsertStreaming("user", userBufRef.current, userMsgIdRef);
        return;
      }
      if (event.type === "turn_complete") {
        const partnerSealed = sealPartnerTurn();
        if (partnerSealed.text && partnerSealed.messageId) {
          lastPartnerLineRef.current = partnerSealed.text;
        }
        // Don't seal the learner immediately — short pauses are normal when speaking L2.
        scheduleUserTurnFlush();
        return;
      }
      if (event.type === "error") {
        setStatus("error");
        setStatusMessage(event.message);
        return;
      }
      if (event.type === "closed") {
        clearUserTurnFlushTimer();
        if (!intentionalCloseRef.current) {
          setStatus("error");
          setStatusMessage("Disconnected — tap Reconnect");
        }
        stopMic();
      }
    },
    [
      clearUserTurnFlushTimer,
      flushPlayback,
      flushUserTurn,
      playPcmChunk,
      scheduleUserTurnFlush,
      sealPartnerTurn,
      stopMic,
      upsertStreaming,
    ],
  );

  const connectLive = useCallback(
    async (mode: "connect" | "reconnect", nextScenario?: Scenario) => {
      const activeScenario = nextScenario ?? scenarioRef.current;
      setStatus(mode === "reconnect" ? "reconnecting" : "connecting");
      setStatusMessage(
        mode === "reconnect"
          ? "Reconnecting…"
          : "Requesting mic & Gemini Live session…",
      );
      partnerBufRef.current = "";
      userBufRef.current = "";
      partnerMsgIdRef.current = null;
      userMsgIdRef.current = null;
      lastPartnerLineRef.current = "";
      lastCoachRef.current = null;
      setMessages([]);

      try {
        // Suppress "disconnected" from the session we're tearing down.
        intentionalCloseRef.current = true;
        cleanupSession();
        intentionalCloseRef.current = false;

        const createRes = await fetch("/api/live/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenarioId: activeScenario.id }),
        });
        const created = (await createRes.json()) as {
          sessionId?: string;
          practiceSessionId?: string;
          model?: string;
          error?: string;
        };
        if (!createRes.ok || !created.sessionId) {
          throw new Error(
            created.error ??
              "Could not start Live session (ADC / Vertex / auth?)",
          );
        }

        const boundSessionId = created.sessionId;
        sessionIdRef.current = boundSessionId;
        practiceSessionIdRef.current = created.practiceSessionId ?? null;

        const es = new EventSource(`/api/live/session/${boundSessionId}`);
        eventSourceRef.current = es;
        es.onmessage = (msg) => {
          // Drop events from a session that was replaced mid-flight.
          if (sessionIdRef.current !== boundSessionId) return;
          try {
            const data = JSON.parse(msg.data) as LiveBridgeEvent | {
              type: "subscribed";
            };
            handleBridgeEvent(data);
          } catch (err) {
            console.error("[session] bad live event", err);
          }
        };
        es.onerror = () => {
          if (intentionalCloseRef.current) return;
          if (sessionIdRef.current !== boundSessionId) return;
          setStatus("error");
          setStatusMessage("Event stream lost — tap Reconnect");
          stopMic();
        };

        await startMic(boundSessionId);
        if (sessionIdRef.current !== boundSessionId) return;
        setStatus("live");
        setStatusMessage(undefined);
      } catch (err) {
        console.error("[session] connect failed", err);
        setStatus("error");
        const msg =
          err instanceof Error ? err.message : "Failed to start session";
        setStatusMessage(
          msg.includes("Permission") || msg.includes("NotAllowed")
            ? "Microphone permission denied"
            : msg,
        );
        intentionalCloseRef.current = true;
        cleanupSession();
      }
    },
    [cleanupSession, handleBridgeEvent, startMic, stopMic],
  );

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      coachAbortRef.current?.abort();
      cleanupSession();
    };
  }, [cleanupSession]);

  const endSession = () => {
    intentionalCloseRef.current = true;
    cleanupSession();
    setStatus("idle");
    setStatusMessage(undefined);
    setMessages([]);
  };

  const onSelectScenario = (next: Scenario) => {
    // Live + scenario switch races two partners; require End first.
    if (
      status === "live" ||
      status === "connecting" ||
      status === "reconnecting"
    ) {
      return;
    }
    if (next.id === scenario.id) return;
    setScenario(next);
  };

  const affordance = coachAffordance(level);

  const onTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = textFallback.trim();
    if (!t) return;
    const id = msgId("user");
    setMessages((prev) => [...prev, { id, role: "user", text: t }]);
    setTextFallback("");
    // Typed line is just another user bubble — polish only if Beginner taps Polish.
  };

  const onRetryCoach = (messageId: string) => {
    const last = lastCoachRef.current;
    if (!last || last.messageId !== messageId) return;
    void runCoach(
      last.mode,
      last.transcript,
      last.context,
      createTurnId(),
      messageId,
    );
  };

  const onUnderstandPartner = (messageId: string) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message || message.role !== "partner" || message.pending) return;
    void runCoach(
      "partner_assist",
      message.text,
      undefined,
      createTurnId(),
      message.id,
    );
  };

  const onPolishLearner = (messageId: string) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message || message.role !== "user" || message.pending) return;
    void runCoach(
      "learner_improve",
      message.text,
      lastPartnerLineRef.current || undefined,
      createTurnId(),
      message.id,
    );
  };

  const live =
    status === "live" || status === "connecting" || status === "reconnecting";

  return (
    <div className="session-shell">
      <ScenarioSidebar
        selectedId={scenario.id}
        level={level}
        live={live}
        onSelectScenario={onSelectScenario}
        onSelectLevel={setLevel}
      />

      <div className="session-main">
        <header className="session-main-top">
          <div className="session-context min-w-0">
            <p className="session-context-label">Conversation studio</p>
            <h1 className="session-context-title">
              <span lang="ko">{scenario.titleKo}</span>
              <span className="session-context-en">{scenario.titleEn}</span>
            </h1>
            <p className="session-context-meta">
              Level
              <span className="session-context-separator" aria-hidden>
                ·
              </span>
              <span className="session-context-level">{level}</span>
            </p>
          </div>
          <div className="session-actions">
            <span
              className={`live-badge ${status === "live" ? "live-badge-on" : ""}`}
            >
              {status === "connecting"
                ? "Connecting"
                : status === "live"
                  ? "Live"
                  : status === "reconnecting"
                    ? "Reconnecting"
                    : status === "error"
                      ? "Error"
                      : "Ready"}
            </span>
            {status === "idle" || status === "error" ? (
              <button
                type="button"
                className="btn-primary session-start-btn"
                onClick={() =>
                  void connectLive(status === "error" ? "reconnect" : "connect")
                }
              >
                {status === "error" ? "Reconnect" : "Start session"}
              </button>
            ) : (
              <button
                type="button"
                className="btn-secondary session-end-btn"
                onClick={endSession}
              >
                End
              </button>
            )}
          </div>
        </header>

        <div className="session-chat-wrap">
          <PartnerPane
            titleKo={scenario.titleKo}
            status={status}
            messages={messages}
            statusMessage={statusMessage}
            allowPartnerCoach={affordance.partnerAssist}
            allowLearnerPolish={affordance.learnerImprove}
            onUnderstandPartner={onUnderstandPartner}
            onPolishLearner={onPolishLearner}
            onRetryCoach={onRetryCoach}
          />
        </div>

        <form className="fallback-bar" onSubmit={onTextSubmit}>
          <div className="fallback-controls">
            <label className="sr-only" htmlFor="text-fallback">
              Type Korean if speech recognition misses a line
            </label>
            <input
              id="text-fallback"
              className="fallback-input"
              placeholder="Type Korean if ASR misses…"
              value={textFallback}
              onChange={(e) => setTextFallback(e.target.value)}
            />
            <button type="submit" className="btn-secondary">
              Add line
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
