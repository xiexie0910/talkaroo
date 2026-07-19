"use client";

/** Compact coaching card rendered under a chat turn. */
import type {
  LearnerImproveResponse,
  PartnerAssistResponse,
} from "@/lib/coach/schema";

export type InlineCoachState = "annotating" | "ready" | "error";

type InlineCoachCardProps = {
  role: "partner" | "user";
  state: InlineCoachState;
  partnerAssist?: PartnerAssistResponse | null;
  learnerImprove?: LearnerImproveResponse | null;
  errorMessage?: string | null;
  onRetry?: () => void;
};

export function InlineCoachCard({
  role,
  state,
  partnerAssist,
  learnerImprove,
  errorMessage,
  onRetry,
}: InlineCoachCardProps) {
  if (state === "annotating") {
    return (
      <div className="inline-coach" data-state="annotating">
        <p className="inline-coach-label">
          <span className="hud-pulse" aria-hidden />
          {role === "partner"
            ? "Finding words & reply ideas…"
            : "Polishing your sentence…"}
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="inline-coach" data-state="error">
        <p className="inline-coach-label">Couldn&apos;t analyze this line</p>
        <p className="text-sm text-[var(--muted)]">
          {errorMessage ?? "Try again."}
        </p>
        {onRetry ? (
          <button type="button" className="btn-secondary mt-2" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  if (role === "partner" && partnerAssist) {
    const empty =
      !partnerAssist.translation_en &&
      partnerAssist.vocab.length === 0 &&
      partnerAssist.suggested_replies.length === 0;
    if (empty) return null;

    return (
      <div className="inline-coach" data-state="ready">
        {partnerAssist.translation_en ? (
          <div className="coach-section">
            <p className="inline-coach-label">Translation</p>
            <p className="coach-translation">{partnerAssist.translation_en}</p>
          </div>
        ) : null}

        {partnerAssist.vocab.length > 0 ? (
          <div
            className={`coach-section ${partnerAssist.translation_en ? "mt-3" : ""}`}
          >
            <p className="inline-coach-label">Words</p>
            <div className="flex flex-wrap gap-2">
              {partnerAssist.vocab.map((item, i) => (
                <div key={`${item.surface}-${i}`} className="tok">
                  <span className="tok-surface" lang="ko">
                    {item.surface}
                  </span>
                  <span className="tok-role">
                    {item.meaning_en}
                    {item.note ? ` · ${item.note}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {partnerAssist.suggested_replies.length > 0 ? (
          <div
            className={`coach-section ${partnerAssist.vocab.length > 0 ? "mt-3" : ""}`}
          >
            <p className="inline-coach-label">You could say</p>
            <ul className="reply-list">
              {partnerAssist.suggested_replies.map((reply, i) => (
                <li key={`${reply.ko}-${i}`} className="reply-card">
                  <p className="reply-ko" lang="ko">
                    {reply.ko}
                  </p>
                  <p className="reply-en">{reply.en}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  if (role === "user" && learnerImprove) {
    if (!learnerImprove.natural_ko && !learnerImprove.tip_en) return null;

    return (
      <div className="inline-coach" data-state="ready">
        <p className="inline-coach-label">
          {learnerImprove.was_already_natural ? "Sounds good" : "More natural"}
        </p>
        {learnerImprove.natural_ko ? (
          <div
            className={`try-box ${learnerImprove.was_already_natural ? "try-box-ok" : ""}`}
          >
            <p lang="ko">{learnerImprove.natural_ko}</p>
          </div>
        ) : null}
        {learnerImprove.tip_en ? (
          <div className="why-box mt-2">
            <strong>Tip</strong>
            <p>{learnerImprove.tip_en}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
