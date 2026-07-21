"use client";

/**
 * Practice session UI + Live voice wiring.
 *
 * Flow: pick scenario/level → Start → Live over WebSocket (Vercel) or
 * HTTP+SSE (local) → transcripts in PartnerPane → coach cards on tap.
 *
 * Level only gates on-tap coaching (see lib/session/level.ts),
 * not the partner’s system prompt. No auto coach after turns.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { PartnerPane, type ChatMessage } from "@/components/PartnerPane";
import { ScenarioSidebar } from "@/components/ScenarioSidebar";
import {
  SessionRecapLoading,
  SessionRecapPanel,
} from "@/components/SessionRecapPanel";
import type {
  CoachApiResult,
  CoachMode,
  CoachResponse,
} from "@/lib/coach/schema";
import {
  startBrowserAsr,
  type BrowserAsr,
} from "@/lib/live/browserAsr";
import { startMicCapture, type MicCapture } from "@/lib/live/micCapture";
import {
  openLiveConnection,
  type LiveConnection,
} from "@/lib/live/openLiveConnection";
import { createPcmPlayer, type PcmPlayer } from "@/lib/live/pcmPlayer";
import type { LiveBridgeEvent } from "@/lib/live/types";
import type { CompleteSessionResult, SessionRecap } from "@/lib/recap/schema";
import {
  getScenario,
  type LearnerLevel,
  type Scenario,
} from "@/lib/scenarios";
import { coachAffordance, shouldRunCoach } from "@/lib/session/level";
import { msgId, patchMessage } from "@/lib/session/messages";
import {
  isCoachableLearnerTranscript,
  isDisplayableLearnerTranscript,
  isNearDuplicateUtterance,
  isTranscriptContinuation,
  looksLikeEchoOfPartner,
  mergeTranscriptChunk,
  preferLearnerCaption,
  sanitizeLearnerTranscript,
} from "@/lib/session/transcript";
import type { ConnectionStatus } from "@/lib/session/types";
import {
  createTurnId,
  shouldApplyCoachResult,
} from "@/lib/session/turnId";

/** Extra client grace after Live turn_complete before sealing a user turn. */
const USER_TURN_GRACE_MS = 2200;

/**
 * Partner transcription often lags / continues after an early turn_complete.
 * Wait briefly so "어, 왔어!" + "어, 왔어! 주말인데…" stay one bubble.
 */
const PARTNER_TURN_GRACE_MS = 750;

/** Merge/drop learner repeats spoken while waiting for the bubble to appear. */
const USER_REPEAT_WINDOW_MS = 5000;

/**
 * Keep mic muted briefly after partner audio so speaker echo / room reverb
 * isn't transcribed as the learner.
 */
const PARTNER_MIC_HANGOVER_MS = 1000;

/**
 * After partner playback, only uplink mic frames with real speech energy so
 * quiet room reverb isn't sent to Live.
 */
const POST_PARTNER_MIC_GATE_MS = 2000;
const POST_PARTNER_SPEAK_RMS = 0.015;

/** Reflect only after the learner has spoken more than this many sealed turns. */
const REFLECT_MIN_USER_TURNS = 3;

type LastCoachRequest = {
  mode: CoachMode;
  transcript: string;
  context?: string;
  messageId: string;
};

export type SessionMissionHandoff = {
  objective: string;
  starterPhrase?: string;
};

type SessionClientProps = {
  initialScenarioId?: string | null;
  initialMission?: SessionMissionHandoff | null;
};

export function SessionClient({
  initialScenarioId = null,
  initialMission = null,
}: SessionClientProps) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textFallback, setTextFallback] = useState("");
  const [scenario, setScenario] = useState<Scenario>(() =>
    getScenario(initialScenarioId),
  );
  const [level, setLevel] = useState<LearnerLevel>("beginner");
  const [missionBanner, setMissionBanner] = useState<SessionMissionHandoff | null>(
    () => initialMission,
  );
  const [recapPhase, setRecapPhase] = useState<"none" | "loading" | "ready">(
    "none",
  );
  const [recap, setRecap] = useState<SessionRecap | null>(null);

  // Refs keep latest values inside Live / audio callbacks without re-subscribing
  const sessionIdRef = useRef<string | null>(null);
  const practiceSessionIdRef = useRef<string | null>(null);
  const liveConnRef = useRef<LiveConnection | null>(null);
  const currentTurnIdRef = useRef<string | null>(null);
  const coachAbortRef = useRef<AbortController | null>(null);
  const lastCoachRef = useRef<LastCoachRequest | null>(null);
  const lastPartnerLineRef = useRef("");
  const lastPartnerMsgIdRef = useRef<string | null>(null);
  const lastUserLineRef = useRef("");
  const lastUserMsgIdRef = useRef<string | null>(null);
  const lastUserSealedAtRef = useRef(0);
  /** performance.now() deadline — mute uplink while partner plays on speakers. */
  const partnerMicMuteUntilRef = useRef(0);
  /** After partner audio, require mic energy before uplink resumes. */
  const postPartnerMicGateUntilRef = useRef(0);
  const playerRef = useRef<PcmPlayer | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const browserAsrRef = useRef<BrowserAsr | null>(null);
  /** Once Live ASR speaks for this turn, it wins over browser captions. */
  const liveUserAsrRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const partnerBufRef = useRef("");
  const userBufRef = useRef("");
  const partnerMsgIdRef = useRef<string | null>(null);
  const userMsgIdRef = useRef<string | null>(null);
  const userTurnFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const partnerTurnFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
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
    partnerMicMuteUntilRef.current = 0;
    // #region agent log
    const body = JSON.stringify({
      sessionId: "647797",
      runId: "echo-post",
      hypothesisId: "F",
      location: "SessionClient.tsx:flushPlayback",
      message: "playback flushed; mute cleared",
      data: {},
      timestamp: Date.now(),
    });
    fetch("http://127.0.0.1:7371/ingest/09059100-ba34-4f53-8078-bfa35b282dd6", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "647797",
      },
      body,
    }).catch(() => {});
    fetch("/api/debug/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {});
    // #endregion
  }, []);

  const isPartnerAudioBlockingMic = useCallback(() => {
    const player = playerRef.current;
    if (player?.isBusy()) return true;
    return performance.now() < partnerMicMuteUntilRef.current;
  }, []);

  const isLikelyPartnerEchoCaption = useCallback((text: string) => {
    const partners = [partnerBufRef.current, lastPartnerLineRef.current];
    return partners.some(
      (partner) => partner && looksLikeEchoOfPartner(text, partner),
    );
  }, []);

  const shouldIgnoreLiveInputAsr = useCallback(
    (text: string) => {
      if (isPartnerAudioBlockingMic()) return true;
      // Drop speaker-bleed captions that match the partner line.
      if (isLikelyPartnerEchoCaption(text)) return true;
      return false;
    },
    [isLikelyPartnerEchoCaption, isPartnerAudioBlockingMic],
  );

  // #region agent log
  const debugEchoLog = useCallback(
    (
      hypothesisId: string,
      location: string,
      message: string,
      data: Record<string, unknown>,
    ) => {
      const player = playerRef.current;
      const now = performance.now();
      const busy = player?.isBusy() ?? false;
      const queuedMs = player?.queuedMsRemaining() ?? 0;
      const muteUntilIn = Math.max(0, partnerMicMuteUntilRef.current - now);
      const blocking = busy || now < partnerMicMuteUntilRef.current;
      const payload = {
        sessionId: "647797",
        runId: "echo-post",
        hypothesisId,
        location,
        message,
        data: {
          ...data,
          busy,
          queuedMs,
          muteUntilIn,
          blocking,
          ignoreAsrIn: 0,
          micGateIn: Math.max(0, postPartnerMicGateUntilRef.current - now),
          rms: micRef.current?.inputRms() ?? null,
        },
        timestamp: Date.now(),
      };
      const body = JSON.stringify(payload);
      // Cursor debug ingest (may fail from HTTPS / CORS).
      fetch("http://127.0.0.1:7371/ingest/09059100-ba34-4f53-8078-bfa35b282dd6", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "647797",
        },
        body,
      }).catch(() => {});
      // Same-origin fallback so local/vercel-dev always captures logs.
      fetch("/api/debug/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {});
    },
    [],
  );
  // #endregion

  const notePartnerAudioPlaying = useCallback(() => {
    const player = playerRef.current;
    const queued = player?.queuedMsRemaining() ?? 0;
    const now = performance.now();
    partnerMicMuteUntilRef.current = Math.max(
      partnerMicMuteUntilRef.current,
      now + queued + PARTNER_MIC_HANGOVER_MS,
    );
    postPartnerMicGateUntilRef.current = Math.max(
      postPartnerMicGateUntilRef.current,
      now + queued + PARTNER_MIC_HANGOVER_MS + POST_PARTNER_MIC_GATE_MS,
    );
    // Partner audio on speakers contaminates Chrome ASR's committed buffer.
    browserAsrRef.current?.resetTurn();
  }, []);

  const stopMic = useCallback(() => {
    browserAsrRef.current?.stop();
    browserAsrRef.current = null;
    liveUserAsrRef.current = false;
    micRef.current?.stop();
    micRef.current = null;
  }, []);

  const playPcmChunk = useCallback(
    (base64: string) => {
      const player = ensurePlayer();
      // Mute mic uplink immediately — don't wait for the chunk to finish decoding.
      partnerMicMuteUntilRef.current = Math.max(
        partnerMicMuteUntilRef.current,
        performance.now() + PARTNER_MIC_HANGOVER_MS,
      );
      void player.playBase64(base64).finally(() => {
        notePartnerAudioPlaying();
        // #region agent log
        debugEchoLog("C", "SessionClient.tsx:playPcmChunk.finally", "after schedule", {
          base64Chars: base64.length,
        });
        // #endregion
      });
      notePartnerAudioPlaying();
      // #region agent log
      debugEchoLog("A", "SessionClient.tsx:playPcmChunk", "partner audio chunk", {
        base64Chars: base64.length,
      });
      // #endregion
    },
    [debugEchoLog, ensurePlayer, notePartnerAudioPlaying],
  );

  const clearUserTurnFlushTimer = useCallback(() => {
    if (userTurnFlushTimerRef.current) {
      clearTimeout(userTurnFlushTimerRef.current);
      userTurnFlushTimerRef.current = null;
    }
  }, []);

  const clearPartnerTurnFlushTimer = useCallback(() => {
    if (partnerTurnFlushTimerRef.current) {
      clearTimeout(partnerTurnFlushTimerRef.current);
      partnerTurnFlushTimerRef.current = null;
    }
  }, []);

  const sealPartnerTurn = useCallback(() => {
    const text = partnerBufRef.current.trim();
    partnerBufRef.current = "";
    const id = finalizeStreaming("partner", partnerMsgIdRef);
    if (text && id) {
      lastPartnerLineRef.current = text;
      lastPartnerMsgIdRef.current = id;
    }
    return { text, messageId: id };
  }, [finalizeStreaming]);

  const sealUserTurn = useCallback(() => {
    const raw = userBufRef.current;
    userBufRef.current = "";
    const text = sanitizeLearnerTranscript(raw);
    const id = userMsgIdRef.current;

    // Drop bubbles that are only ASR junk ("{}", "{Rolle}", etc.).
    if (!isDisplayableLearnerTranscript(text)) {
      userMsgIdRef.current = null;
      if (id) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
      return { text: "", messageId: null };
    }

    const recentRepeat =
      lastUserMsgIdRef.current &&
      Date.now() - lastUserSealedAtRef.current < USER_REPEAT_WINDOW_MS &&
      isNearDuplicateUtterance(lastUserLineRef.current, text);

    // Learner repeated themselves waiting for UI — keep one bubble.
    if (recentRepeat && id && id !== lastUserMsgIdRef.current) {
      const keepId = lastUserMsgIdRef.current!;
      const keepText =
        text.length > lastUserLineRef.current.length
          ? text
          : lastUserLineRef.current;
      userMsgIdRef.current = null;
      lastUserLineRef.current = keepText;
      lastUserSealedAtRef.current = Date.now();
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== id)
          .map((m) =>
            m.id === keepId ? { ...m, pending: false, text: keepText } : m,
          ),
      );
      return { text: keepText, messageId: keepId };
    }

    userMsgIdRef.current = null;
    lastUserLineRef.current = text;
    lastUserMsgIdRef.current = id;
    lastUserSealedAtRef.current = Date.now();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, pending: false, text } : m,
      ),
    );
    return { text, messageId: id };
  }, []);

  const flushPartnerTurn = useCallback(() => {
    clearPartnerTurnFlushTimer();
    return sealPartnerTurn();
  }, [clearPartnerTurnFlushTimer, sealPartnerTurn]);

  const schedulePartnerTurnFlush = useCallback(() => {
    clearPartnerTurnFlushTimer();
    if (!partnerBufRef.current.trim() && !partnerMsgIdRef.current) return;
    partnerTurnFlushTimerRef.current = setTimeout(() => {
      partnerTurnFlushTimerRef.current = null;
      flushPartnerTurn();
    }, PARTNER_TURN_GRACE_MS);
  }, [clearPartnerTurnFlushTimer, flushPartnerTurn]);

  /** If Live continues the last sealed partner line, reopen that bubble. */
  const reopenPartnerIfContinuation = useCallback(
    (incoming: string) => {
      const lastId = lastPartnerMsgIdRef.current;
      const lastText = lastPartnerLineRef.current;
      if (!lastId || !lastText) return false;
      if (!isTranscriptContinuation(lastText, incoming)) return false;
      partnerMsgIdRef.current = lastId;
      partnerBufRef.current = lastText;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === lastId ? { ...m, pending: true, text: lastText } : m,
        ),
      );
      return true;
    },
    [],
  );

  const applyUserCaption = useCallback(
    (text: string, mode: "replace" | "append") => {
      // Speakers → mic echo of the partner must not become a "You" bubble.
      if (isPartnerAudioBlockingMic()) return;

      const cleaned = sanitizeLearnerTranscript(text);
      // Ignore noise captions; keep any good text already in the bubble.
      if (!isDisplayableLearnerTranscript(cleaned)) return;

      // Extra guard: caption matches what the partner just said / is saying.
      if (isLikelyPartnerEchoCaption(cleaned)) {
        // #region agent log
        debugEchoLog("D", "SessionClient.tsx:applyUserCaption", "drop echo caption", {
          textPreview: cleaned.slice(0, 40),
          partnerPreview: (
            partnerBufRef.current || lastPartnerLineRef.current
          ).slice(0, 40),
        });
        // #endregion
        return;
      }

      clearUserTurnFlushTimer();

      // Repeat while waiting for the last bubble → reopen it instead of a 2nd line.
      if (
        !userMsgIdRef.current &&
        lastUserMsgIdRef.current &&
        Date.now() - lastUserSealedAtRef.current < USER_REPEAT_WINDOW_MS &&
        (isNearDuplicateUtterance(lastUserLineRef.current, cleaned) ||
          isTranscriptContinuation(lastUserLineRef.current, cleaned))
      ) {
        userMsgIdRef.current = lastUserMsgIdRef.current;
        userBufRef.current = lastUserLineRef.current;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === lastUserMsgIdRef.current
              ? { ...m, pending: true, text: lastUserLineRef.current }
              : m,
          ),
        );
      }

      if (!userBufRef.current) {
        flushPlayback();
        flushPartnerTurn();
      }
      userBufRef.current = mergeTranscriptChunk(
        userBufRef.current,
        cleaned,
        mode,
      );
      const display = sanitizeLearnerTranscript(userBufRef.current);
      if (!isDisplayableLearnerTranscript(display)) return;
      userBufRef.current = display;
      upsertStreaming("user", display, userMsgIdRef);
    },
    [
      clearUserTurnFlushTimer,
      debugEchoLog,
      flushPartnerTurn,
      flushPlayback,
      isLikelyPartnerEchoCaption,
      isPartnerAudioBlockingMic,
      upsertStreaming,
    ],
  );

  const startMic = useCallback(
    async (sessionId: string, sendAudio: (base64Pcm: string) => void) => {
      stopMic();
      // #region agent log
      let lastMicSendAllowed: boolean | null = null;
      let lastMicDropLogAt = 0;
      let lastMicSendLogAt = 0;
      // #endregion
      micRef.current = await startMicCapture({
        sendAudio,
        isActive: () => sessionIdRef.current === sessionId,
        // Don't upload speaker bleed while the partner is talking / just finished.
        shouldSend: (rms) => {
          if (sessionIdRef.current !== sessionId) return false;
          if (isPartnerAudioBlockingMic()) {
            // #region agent log
            const allow = false;
            const now = Date.now();
            if (lastMicSendAllowed !== allow) {
              lastMicSendAllowed = allow;
              debugEchoLog(
                "A",
                "SessionClient.tsx:shouldSend",
                "mic uplink muted",
                { allow, rms },
              );
            } else if (now - lastMicDropLogAt > 800) {
              lastMicDropLogAt = now;
              debugEchoLog(
                "A",
                "SessionClient.tsx:shouldSend",
                "mic still muted",
                { allow, rms },
              );
            }
            // #endregion
            return false;
          }
          if (performance.now() < postPartnerMicGateUntilRef.current) {
            const allow = rms >= POST_PARTNER_SPEAK_RMS;
            // #region agent log
            const now = Date.now();
            if (lastMicSendAllowed !== allow) {
              lastMicSendAllowed = allow;
              debugEchoLog(
                "B",
                "SessionClient.tsx:shouldSend",
                allow ? "mic gate open (energy)" : "mic gate closed (quiet)",
                { allow, rms },
              );
            } else if (!allow && now - lastMicDropLogAt > 800) {
              lastMicDropLogAt = now;
              debugEchoLog(
                "B",
                "SessionClient.tsx:shouldSend",
                "mic gate still closed",
                { allow, rms },
              );
            }
            // #endregion
            return allow;
          }
          // #region agent log
          const allow = true;
          const now = Date.now();
          if (lastMicSendAllowed !== allow) {
            lastMicSendAllowed = allow;
            debugEchoLog(
              "A",
              "SessionClient.tsx:shouldSend",
              "mic uplink unmuted",
              { allow, rms },
            );
          } else if (now - lastMicSendLogAt > 1500) {
            lastMicSendLogAt = now;
            debugEchoLog("B", "SessionClient.tsx:shouldSend", "mic sending", {
              allow,
              rms,
            });
          }
          // #endregion
          return true;
        },
      });
      // Instant captions while speaking — Live ASR often arrives only at turn end.
      // Keep browser ASR isActive tied to the session only (not partner mute).
      // Partner mute / echo filters run in onUpdate; gating isActive on mute
      // prevented Chrome from restarting after partner speech (no interim captions).
      liveUserAsrRef.current = false;
      browserAsrRef.current = startBrowserAsr({
        lang: "ko-KR",
        isActive: () => sessionIdRef.current === sessionId,
        onUpdate: (text) => {
          if (sessionIdRef.current !== sessionId) return;
          if (liveUserAsrRef.current) return;
          if (isPartnerAudioBlockingMic()) {
            // #region agent log
            debugEchoLog(
              "E",
              "SessionClient.tsx:browserAsr",
              "drop browser asr (partner mute)",
              {
                blocked: true,
                textLen: text.length,
                textPreview: text.slice(0, 40),
                partnerPreview: partnerBufRef.current.slice(0, 40),
              },
            );
            // #endregion
            return;
          }
          if (isLikelyPartnerEchoCaption(text)) {
            // #region agent log
            debugEchoLog(
              "E",
              "SessionClient.tsx:browserAsr",
              "drop browser asr (echo)",
              {
                blocked: true,
                textLen: text.length,
                textPreview: text.slice(0, 40),
                partnerPreview: (
                  partnerBufRef.current || lastPartnerLineRef.current
                ).slice(0, 40),
              },
            );
            // #endregion
            browserAsrRef.current?.resetTurn();
            return;
          }
          // #region agent log
          debugEchoLog(
            "E",
            "SessionClient.tsx:browserAsr",
            "accept browser asr",
            {
              blocked: false,
              textLen: text.length,
              textPreview: text.slice(0, 40),
              partnerPreview: partnerBufRef.current.slice(0, 40),
            },
          );
          // #endregion
          applyUserCaption(text, "replace");
        },
      });
    },
    [
      applyUserCaption,
      debugEchoLog,
      isLikelyPartnerEchoCaption,
      isPartnerAudioBlockingMic,
      stopMic,
    ],
  );

  const cleanupSession = useCallback(() => {
    if (userTurnFlushTimerRef.current) {
      clearTimeout(userTurnFlushTimerRef.current);
      userTurnFlushTimerRef.current = null;
    }
    if (partnerTurnFlushTimerRef.current) {
      clearTimeout(partnerTurnFlushTimerRef.current);
      partnerTurnFlushTimerRef.current = null;
    }
    coachAbortRef.current?.abort();
    coachAbortRef.current = null;
    currentTurnIdRef.current = null;
    stopMic();
    playerRef.current?.dispose();
    playerRef.current = null;
    const conn = liveConnRef.current;
    liveConnRef.current = null;
    sessionIdRef.current = null;
    practiceSessionIdRef.current = null;
    conn?.close();
  }, [stopMic]);

  /** Seal the learner bubble only — polish is on tap (beginner), never auto. */
  const flushUserTurn = useCallback(() => {
    clearUserTurnFlushTimer();
    sealUserTurn();
    liveUserAsrRef.current = false;
    browserAsrRef.current?.resetTurn();
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
        flushPartnerTurn();
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
        clearPartnerTurnFlushTimer();
        // Early turn_complete can seal mid-utterance; reopen if ASR continues it.
        if (
          !partnerMsgIdRef.current &&
          !partnerBufRef.current.trim() &&
          reopenPartnerIfContinuation(event.text)
        ) {
          /* buffer + id restored */
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
        // Ignore echo ASR while partner audio is on speakers / delayed bleed.
        const blocked = shouldIgnoreLiveInputAsr(event.text);
        // #region agent log
        debugEchoLog(
          "D",
          "SessionClient.tsx:input_transcription",
          blocked ? "drop live user asr (echo guard)" : "accept live user asr",
          {
            blocked,
            mode: event.mode,
            textLen: event.text.length,
            textPreview: event.text.slice(0, 40),
            partnerPreview: (
              partnerBufRef.current || lastPartnerLineRef.current
            ).slice(0, 40),
            echo:
              isLikelyPartnerEchoCaption(event.text) ||
              looksLikeEchoOfPartner(
                event.text,
                lastPartnerLineRef.current,
              ),
          },
        );
        // #endregion
        if (blocked) return;
        // First Live chunk: merge with browser preview instead of wiping a
        // better Chrome caption with a short/wrong Live guess.
        if (!liveUserAsrRef.current) {
          liveUserAsrRef.current = true;
          const preview = userBufRef.current;
          const liveText = sanitizeLearnerTranscript(event.text);
          if (preview && liveText) {
            applyUserCaption(preferLearnerCaption(preview, liveText), "replace");
            return;
          }
          // No preview yet — append deltas start clean; replace uses Live text.
          if (event.mode === "append" && liveText) {
            userBufRef.current = "";
          }
        }
        applyUserCaption(event.text, event.mode);
        return;
      }
      if (event.type === "turn_complete") {
        // Delay partner seal — output ASR often continues after turn_complete.
        schedulePartnerTurnFlush();
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
      applyUserCaption,
      clearPartnerTurnFlushTimer,
      clearUserTurnFlushTimer,
      debugEchoLog,
      flushPartnerTurn,
      flushPlayback,
      flushUserTurn,
      isLikelyPartnerEchoCaption,
      isPartnerAudioBlockingMic,
      playPcmChunk,
      reopenPartnerIfContinuation,
      schedulePartnerTurnFlush,
      scheduleUserTurnFlush,
      shouldIgnoreLiveInputAsr,
      stopMic,
      upsertStreaming,
    ],
  );

  const connectLive = useCallback(
    async (mode: "connect" | "reconnect", nextScenario?: Scenario) => {
      const activeScenario = nextScenario ?? scenarioRef.current;
      setRecapPhase("none");
      setRecap(null);
      setMissionBanner(null);
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
      lastPartnerMsgIdRef.current = null;
      lastUserLineRef.current = "";
      lastUserMsgIdRef.current = null;
      lastUserSealedAtRef.current = 0;
      lastCoachRef.current = null;
      setMessages([]);

      try {
        // Suppress "disconnected" from the session we're tearing down.
        intentionalCloseRef.current = true;
        cleanupSession();
        intentionalCloseRef.current = false;

        const conn = await openLiveConnection({
          scenarioId: activeScenario.id,
          onReady: (ready) => {
            sessionIdRef.current = ready.sessionId;
            practiceSessionIdRef.current = ready.practiceSessionId ?? null;
          },
          onEvent: (data) => {
            // onReady sets sessionIdRef before events; cleanup nulls it on tear-down.
            if (!sessionIdRef.current) return;
            handleBridgeEvent(data);
          },
          onTransportLost: () => {
            if (intentionalCloseRef.current) return;
            if (!sessionIdRef.current) return;
            setStatus("error");
            setStatusMessage("Event stream lost — tap Reconnect");
            stopMic();
          },
        });

        liveConnRef.current = conn;
        const boundSessionId = conn.sessionId;
        sessionIdRef.current = boundSessionId;
        practiceSessionIdRef.current = conn.practiceSessionId ?? null;

        await startMic(boundSessionId, conn.sendAudio);
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
    setRecapPhase("none");
    setRecap(null);
  };

  const sealedUserTurnCount = messages.filter(
    (m) => m.role === "user" && !m.pending && m.text.trim(),
  ).length;
  const canReflect = sealedUserTurnCount > REFLECT_MIN_USER_TURNS;

  const endAndReflect = async () => {
    const practiceSessionId = practiceSessionIdRef.current;
    const transcript = messages
      .filter((m) => m.text.trim() && !m.pending)
      .map((m) => ({ role: m.role, text: m.text.trim() }));

    intentionalCloseRef.current = true;
    cleanupSession();
    setStatus("idle");
    setStatusMessage(undefined);
    setMessages([]);
    setRecapPhase("loading");
    setRecap(null);

    if (!practiceSessionId) {
      setRecapPhase("none");
      return;
    }

    try {
      const res = await fetch(
        `/api/practice/sessions/${practiceSessionId}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript }),
        },
      );
      const json = (await res.json()) as CompleteSessionResult;
      if (!res.ok || "error" in json && json.error) {
        throw new Error(
          "error" in json && json.error ? json.message : "Recap failed",
        );
      }
      if (!("recap" in json) || !json.recap) {
        throw new Error("Recap missing");
      }
      setRecap(json.recap);
      setRecapPhase("ready");
    } catch (err) {
      console.error("[session] reflect failed", err);
      setRecapPhase("none");
      setStatusMessage(
        err instanceof Error ? err.message : "Could not build your recap",
      );
    }
  };

  const dismissRecap = () => {
    setRecapPhase("none");
    setRecap(null);
  };

  const practiceRecapMission = () => {
    if (!recap) {
      dismissRecap();
      return;
    }
    setScenario(getScenario(recap.nextMission.scenarioId));
    setMissionBanner({
      objective: recap.nextMission.objective,
      starterPhrase: recap.nextMission.starterPhrase,
    });
    setMessages([]);
    setStatus("idle");
    setStatusMessage(undefined);
    dismissRecap();
  };

  const backToPractice = () => {
    setMissionBanner(null);
    setMessages([]);
    setStatus("idle");
    setStatusMessage(undefined);
    dismissRecap();
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
    // Leaving recap via sidebar should feel like "back to practice".
    if (recapPhase !== "none") {
      dismissRecap();
      setMissionBanner(null);
    }
    if (next.id === scenario.id) return;
    setScenario(next);
    setMissionBanner(null);
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
            <h1 className="session-context-title">
              <span lang="ko">{scenario.titleKo}</span>
              <span className="session-context-en">{scenario.titleEn}</span>
              <span className="session-context-separator" aria-hidden>
                ·
              </span>
              <span className="session-context-level">{level}</span>
            </h1>
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
            ) : canReflect ? (
              <button
                type="button"
                className="btn-secondary session-end-btn"
                onClick={() => void endAndReflect()}
              >
                End &amp; reflect
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
          {recapPhase === "loading" ? (
            <SessionRecapLoading />
          ) : recapPhase === "ready" && recap ? (
            <SessionRecapPanel
              recap={recap}
              onPracticeMission={practiceRecapMission}
              onBackToPractice={backToPractice}
            />
          ) : (
            <>
              {missionBanner && status === "idle" ? (
                <div className="mission-banner">
                  <p className="mission-banner-label">Next mission</p>
                  <p className="mission-banner-body">{missionBanner.objective}</p>
                  {missionBanner.starterPhrase ? (
                    <p className="mission-banner-starter" lang="ko">
                      Starter: {missionBanner.starterPhrase}
                    </p>
                  ) : null}
                </div>
              ) : null}
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
            </>
          )}
        </div>

        {recapPhase === "none" ? (
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
        ) : null}
      </div>
    </div>
  );
}
