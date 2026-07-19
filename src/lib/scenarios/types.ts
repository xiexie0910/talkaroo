import { z } from "zod";

export const learnerLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);
export type LearnerLevel = z.infer<typeof learnerLevelSchema>;

export const LEARNER_LEVELS: {
  id: LearnerLevel;
  label: string;
  short: string;
  hint: string;
}[] = [
  {
    id: "beginner",
    label: "Beginner",
    short: "Beg",
    hint: "On tap: Understand partner lines + Polish your lines. Nothing auto-runs.",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    short: "Int",
    hint: "On tap: Understand partner (translation, words, reply ideas). No polish.",
  },
  {
    id: "advanced",
    label: "Advanced",
    short: "Adv",
    hint: "Conversation only — no coach UI. Fastest, lowest cost.",
  },
];

export type Scenario = {
  id: string;
  titleKo: string;
  titleEn: string;
  blurb: string;
  starterLine: string;
  /** Kickoff instruction sent after Live connect (English, to the model). */
  kickoff: string;
  systemInstruction: string;
};
