import type { CoachMode } from "@/lib/coach/schema";
import type { LearnerLevel } from "@/lib/scenarios/types";

/**
 * Coaching by level — Live partner prompt never changes.
 * No mode auto-fires on every turn (async coach lags the conversation).
 *
 * | Level        | Understand this (partner) | Polish (learner) | Auto coach |
 * |--------------|---------------------------|------------------|------------|
 * | beginner     | on tap                    | on tap           | none       |
 * | intermediate | on tap                    | off              | none       |
 * | advanced     | off                       | off              | none       |
 *
 * Cost: Advanced → 0 coach calls. Intermediate → only partner taps.
 * Beginner → partner + polish taps only when the learner asks.
 */

export type CoachAffordance = {
  /** Show “Understand this” under partner lines */
  partnerAssist: boolean;
  /** Show “Polish” under learner lines */
  learnerImprove: boolean;
};

export function coachAffordance(level: LearnerLevel): CoachAffordance {
  switch (level) {
    case "beginner":
      return { partnerAssist: true, learnerImprove: true };
    case "intermediate":
      return { partnerAssist: true, learnerImprove: false };
    case "advanced":
      return { partnerAssist: false, learnerImprove: false };
  }
}

/** Whether a coach API mode is allowed for this level (tap-triggered). */
export function shouldRunCoach(level: LearnerLevel, mode: CoachMode): boolean {
  const a = coachAffordance(level);
  if (mode === "partner_assist") return a.partnerAssist;
  return a.learnerImprove;
}
