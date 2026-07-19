"use client";

/** Left rail: scenario list + learner level (coaching intensity). */
import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  LEARNER_LEVELS,
  scenarios,
  type LearnerLevel,
  type Scenario,
} from "@/lib/scenarios";

type ScenarioSidebarProps = {
  selectedId: string;
  level: LearnerLevel;
  live: boolean;
  onSelectScenario: (scenario: Scenario) => void;
  onSelectLevel: (level: LearnerLevel) => void;
};

export function ScenarioSidebar({
  selectedId,
  level,
  live,
  onSelectScenario,
  onSelectLevel,
}: ScenarioSidebarProps) {
  const levelMeta = LEARNER_LEVELS.find((l) => l.id === level);

  return (
    <aside className="scenario-sidebar">
      {/* Decorative depth — ignore for a11y */}
      <div className="scenario-sidebar-aura" aria-hidden />

      <div className="scenario-sidebar-top">
        <p className="brand-mark">Talkaroo</p>
        <p className="scenario-sidebar-tagline">
          Pick a scene · coaching stays on tap
        </p>
      </div>

      <div className="scenario-nav-label">Scenarios</div>
      <nav className="scenario-list" aria-label="Practice scenarios">
        {scenarios.map((scenario, index) => {
          const active = scenario.id === selectedId;
          return (
            <button
              key={scenario.id}
              type="button"
              className={`scenario-item ${active ? "is-active" : ""} ${live ? "is-locked" : ""}`}
              aria-current={active ? "true" : undefined}
              aria-disabled={live || undefined}
              disabled={live}
              title={
                live
                  ? "End the session before switching scenarios"
                  : undefined
              }
              onClick={() => onSelectScenario(scenario)}
            >
              <span className="scenario-item-index" aria-hidden>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="scenario-item-body">
                <span className="scenario-item-ko" lang="ko">
                  {scenario.titleKo}
                </span>
                <span className="scenario-item-en">{scenario.titleEn}</span>
                <span className="scenario-item-blurb">{scenario.blurb}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="scenario-level-block">
        <div className="scenario-nav-label">Level</div>
        <div className="level-row" role="radiogroup" aria-label="Learner level">
          {LEARNER_LEVELS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={level === item.id}
              className={`level-chip ${level === item.id ? "is-on" : ""}`}
              onClick={() => onSelectLevel(item.id)}
              title={item.hint}
            >
              {item.short}
            </button>
          ))}
        </div>
        <p className="level-hint">{levelMeta?.hint}</p>
        {live ? (
          <p className="level-hint level-hint-live">
            End the session to switch scenarios — keeps the partner in sync.
          </p>
        ) : null}
      </div>

      <div className="scenario-sidebar-foot">
        <Link href="/history" className="btn-secondary w-full text-center">
          History
        </Link>
        <SignOutButton />
      </div>
    </aside>
  );
}
