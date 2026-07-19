"use client";

/** Scrollable conversation thread + optional on-tap coach triggers. */
import { useEffect, useRef } from "react";
import {
  InlineCoachCard,
  type InlineCoachState,
} from "@/components/InlineCoachCard";
import type {
  LearnerImproveResponse,
  PartnerAssistResponse,
} from "@/lib/coach/schema";
import type { ConnectionStatus } from "@/lib/session/types";

export type ChatMessage = {
  id: string;
  role: "partner" | "user";
  text: string;
  /** Still receiving transcript chunks */
  pending?: boolean;
  coachState?: InlineCoachState;
  partnerAssist?: PartnerAssistResponse | null;
  learnerImprove?: LearnerImproveResponse | null;
  coachError?: string | null;
};

type PartnerPaneProps = {
  titleKo: string;
  status: ConnectionStatus;
  messages: ChatMessage[];
  statusMessage?: string;
  /** Show “Understand this” under partner lines */
  allowPartnerCoach?: boolean;
  /** Show “Polish” under learner lines (beginner) */
  allowLearnerPolish?: boolean;
  onUnderstandPartner?: (messageId: string) => void;
  onPolishLearner?: (messageId: string) => void;
  onRetryCoach?: (messageId: string) => void;
};

export function PartnerPane({
  titleKo,
  status,
  messages,
  statusMessage,
  allowPartnerCoach = true,
  allowLearnerPolish = false,
  onUnderstandPartner,
  onPolishLearner,
  onRetryCoach,
}: PartnerPaneProps) {
  const live = status === "live";
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <section className="partner-pane flex h-full min-h-0 flex-col">
      <div className="partner-pane-aura" aria-hidden />
      <div className="partner-pane-grid" aria-hidden />

      <div
        ref={threadRef}
        className="chat-thread"
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p className="chat-empty-kicker">Ready when you are</p>
            <p className="chat-empty-title">Start a conversation</p>
            <p className="chat-empty-body">
              Pick a scenario and level, then start. Coaching stays on tap —
              nothing interrupts while you speak.
            </p>
            <div className="chat-empty-rule" aria-hidden />
            <p className="chat-empty-note">Your Korean, your pace.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-block ${msg.role === "user" ? "chat-block-user" : "chat-block-partner"}`}
            >
              <div
                className={`chat-row ${msg.role === "user" ? "chat-row-user" : "chat-row-partner"}`}
              >
                {msg.role === "partner" ? (
                  <div
                    className={`chat-avatar partner sm ${msg.pending ? "is-speaking" : ""}`}
                    aria-hidden
                  >
                    말
                  </div>
                ) : null}
                <div className="chat-turn">
                  <p className="chat-role-label">
                    {msg.role === "partner" ? titleKo : "You"}
                    {msg.pending ? " · …" : ""}
                  </p>
                  <div
                    className={`chat-bubble ${msg.role} ${msg.pending ? "pending" : ""}`}
                    lang="ko"
                  >
                    {msg.text}
                  </div>
                </div>
                {msg.role === "user" ? (
                  <div
                    className={`chat-avatar user sm ${msg.pending ? "is-speaking" : ""}`}
                    aria-hidden
                  >
                    You
                  </div>
                ) : null}
              </div>

              {allowPartnerCoach &&
              msg.role === "partner" &&
              !msg.pending &&
              !msg.coachState ? (
                <button
                  type="button"
                  className="coach-request"
                  onClick={() => onUnderstandPartner?.(msg.id)}
                >
                  Understand this
                </button>
              ) : null}

              {allowLearnerPolish &&
              msg.role === "user" &&
              !msg.pending &&
              !msg.coachState ? (
                <button
                  type="button"
                  className="coach-request"
                  onClick={() => onPolishLearner?.(msg.id)}
                >
                  Polish
                </button>
              ) : null}

              {msg.coachState ? (
                <InlineCoachCard
                  role={msg.role}
                  state={msg.coachState}
                  partnerAssist={msg.partnerAssist}
                  learnerImprove={msg.learnerImprove}
                  errorMessage={msg.coachError}
                  onRetry={
                    onRetryCoach && msg.coachState === "error"
                      ? () => onRetryCoach(msg.id)
                      : undefined
                  }
                />
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className={`mic-bar ${live ? "is-live" : ""}`}>
        <span className="mic-wave" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>
          {status === "live"
            ? "Listening — speak Korean"
            : (statusMessage ?? "Session not started")}
        </span>
      </div>
    </section>
  );
}
