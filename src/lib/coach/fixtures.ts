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
  heard_as_ko: "오늘 김치 먹었어요",
  meant_en: "I ate kimchi today.",
  natural_ko: "오늘 김치를 먹었어요.",
  natural_en: "I ate kimchi today.",
  formality: "haeyo",
  formality_fit: "fits",
  tips_en: [
    "Mark the object: 김치 → 김치를 — same meaning, more natural.",
  ],
  was_already_natural: false,
};

/** ASR / context mix-up that should be corrected from partner context */
export const fixtureLearnerContextFix: CoachResponse = {
  mode: "learner_improve",
  user_sentence: "맞아. 대구 오랜만이다. 잘 지냈어요.",
  heard_as_ko: "맞아. 대구 오랜만이다. 잘 지냈어요.",
  meant_en: "Right — it's been a really long time. Have you been well?",
  natural_ko: "맞아. 되게 오랜만이다. 잘 지냈어?",
  natural_en: "Right. It's been a really long time. Have you been well?",
  formality: "mixed",
  formality_fit: "too_formal",
  tips_en: [
    "대구 (Daegu, the city) doesn't fit here — you probably meant 되게 (“really”), like your partner said.",
    "Keep one speech level with your friend: 잘 지냈어요 → 잘 지냈어?",
  ],
  was_already_natural: false,
};

/** Already-natural learner line */
export const fixtureLearnerNatural: CoachResponse = {
  mode: "learner_improve",
  user_sentence: "오늘 좀 바빴어요.",
  heard_as_ko: "오늘 좀 바빴어요.",
  meant_en: "I was a bit busy today.",
  natural_ko: "오늘 좀 바빴어요.",
  natural_en: "I was a bit busy today.",
  formality: "haeyo",
  formality_fit: "fits",
  tips_en: ["This already sounds like something a native would say here."],
  was_already_natural: true,
};

/** Garbage / non-Korean ASR on learner path */
export const fixtureLearnerGarbage: CoachResponse = {
  mode: "learner_improve",
  user_sentence: "",
  heard_as_ko: "",
  meant_en: "",
  natural_ko: "",
  natural_en: "",
  formality: "unclear",
  formality_fit: "n_a",
  tips_en: [
    "Couldn't catch clear Korean — try saying a short sentence in Korean.",
  ],
  was_already_natural: false,
};
