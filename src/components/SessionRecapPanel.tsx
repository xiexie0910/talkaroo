"use client";

import type { SessionRecap } from "@/lib/recap/schema";
import { getScenario } from "@/lib/scenarios";

type SessionRecapPanelProps = {
  recap: SessionRecap;
  loading?: boolean;
  onPracticeMission: () => void;
  onBackToPractice: () => void;
};

export function SessionRecapPanel({
  recap,
  loading,
  onPracticeMission,
  onBackToPractice,
}: SessionRecapPanelProps) {
  if (loading) {
    return (
      <section className="recap-panel" aria-busy="true" aria-live="polite">
        <p className="recap-loading">Finding your next useful phrase…</p>
      </section>
    );
  }

  const next = getScenario(recap.nextMission.scenarioId);

  return (
    <section className="recap-panel" aria-label="Session recap">
      <header className="recap-header">
        <p className="kicker">Session recap</p>
        <h2 className="recap-title">Here&apos;s your next useful step</h2>
      </header>

      <div className="recap-cards">
        <article className="recap-card">
          <h3 className="recap-card-label">You handled</h3>
          <p className="recap-card-body">{recap.win}</p>
        </article>

        <article className="recap-card">
          <h3 className="recap-card-label">Try this next</h3>
          <p className="recap-phrase" lang="ko">
            {recap.focus.korean}
          </p>
          <p className="recap-card-body">{recap.focus.english}</p>
          <p className="recap-reason">{recap.focus.reason}</p>
        </article>

        <article className="recap-card">
          <h3 className="recap-card-label">Next mission</h3>
          <p className="recap-mission-scene">
            <span lang="ko">{next.titleKo}</span>
            <span className="recap-mission-en"> · {next.titleEn}</span>
          </p>
          <p className="recap-card-body">{recap.nextMission.objective}</p>
          <p className="recap-starter" lang="ko">
            Starter: {recap.nextMission.starterPhrase}
          </p>
        </article>
      </div>

      <div className="recap-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={onPracticeMission}
        >
          Practice this mission
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={onBackToPractice}
        >
          Back to practice
        </button>
      </div>
    </section>
  );
}

export function SessionRecapLoading() {
  return (
    <section className="recap-panel" aria-busy="true" aria-live="polite">
      <p className="recap-loading">Finding your next useful phrase…</p>
    </section>
  );
}
