import type { CoachResponse } from "./schema";

/** Partner just asked about the day — vocab + reply scaffolds */
export const fixturePartnerAssist: CoachResponse = {
  mode: "partner_assist",
  partner_sentence: "안녕하세요! 오늘 하루 어땠어요?",
  translation_en: "Hello! How was your day today?",
  vocab: [
    {
      surface: "하루",
      meaning_en: "day / one's day",
      note: "everyday noun",
    },
    {
      surface: "어땠어요",
      meaning_en: "how was it?",
      note: "past polite question",
    },
  ],
  suggested_replies: [
    {
      ko: "괜찮았어요. 조금 바빴어요.",
      en: "It was fine. I was a bit busy.",
      pattern: "I was busy…",
    },
    {
      ko: "일이 많아서 바빴어요.",
      en: "I was busy because of work.",
      pattern: "I've been busy because of X",
    },
  ],
};

/** Learner sentence that can be more natural */
export const fixtureLearnerImprove: CoachResponse = {
  mode: "learner_improve",
  user_sentence: "오늘 김치 먹었어요",
  natural_ko: "오늘 김치를 먹었어요.",
  tip_en:
    "Add object particle 를 after 김치 — Korean marks the thing eaten with 을/를.",
  was_already_natural: false,
};

/** Already-natural learner line */
export const fixtureLearnerNatural: CoachResponse = {
  mode: "learner_improve",
  user_sentence: "오늘 좀 바빴어요.",
  natural_ko: "오늘 좀 바빴어요.",
  tip_en: "Sounds natural and polite — nice everyday reply.",
  was_already_natural: true,
};

/** Garbage / non-Korean ASR on learner path */
export const fixtureLearnerGarbage: CoachResponse = {
  mode: "learner_improve",
  user_sentence: "",
  natural_ko: "",
  tip_en: "Couldn't catch clear Korean — try saying a short sentence in Korean.",
  was_already_natural: false,
};
