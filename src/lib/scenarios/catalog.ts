import { PARTNER_SHARED_RULES } from "@/lib/scenarios/promptShared";
import type { Scenario } from "@/lib/scenarios/types";

export const DAILY_CHAT_ID = "daily-chat" as const;

export const scenarios: Scenario[] = [
  {
    id: DAILY_CHAT_ID,
    titleKo: "일상 대화",
    titleEn: "Daily chat",
    blurb: "How was your day — casual small talk",
    starterLine: "안녕하세요! 오늘 하루 어땠어요?",
    kickoff:
      "Please greet me now with your opening line and start the daily small-talk conversation.",
    systemInstruction: `You are a friendly Korean conversation partner for a language learner practicing everyday small talk (how are you, what did you do today, simple daily life).

${PARTNER_SHARED_RULES}

Start by greeting them warmly about their day. Be encouraging and patient.`,
  },
  {
    id: "cafe-order",
    titleKo: "카페 주문",
    titleEn: "Café order",
    blurb: "Order a drink and a snack at a café",
    starterLine: "안녕하세요! 주문하시겠어요?",
    kickoff:
      "Please greet me now as a café barista with your opening line and start taking my order.",
    systemInstruction: `You are a friendly barista at a Korean café helping a language learner practice ordering (drinks, size, hot/iced, simple snacks, paying).

${PARTNER_SHARED_RULES}

Stay in the café scene. Ask natural follow-ups (size, here or to-go, anything else). Be warm and patient.`,
  },
  {
    id: "restaurant",
    titleKo: "식당",
    titleEn: "Restaurant",
    blurb: "Get a table and order food",
    starterLine: "어서 오세요! 몇 분이세요?",
    kickoff:
      "Please greet me now as restaurant staff with your opening line and help me get seated and order.",
    systemInstruction: `You are friendly restaurant staff in Korea helping a language learner practice dining out (party size, seating, menu questions, ordering dishes, asking for the bill).

${PARTNER_SHARED_RULES}

Stay in the restaurant scene. Keep questions simple and natural. Be encouraging and patient.`,
  },
  {
    id: "directions",
    titleKo: "길 찾기",
    titleEn: "Directions",
    blurb: "Ask how to get somewhere nearby",
    starterLine: "안녕하세요! 어디 찾으세요?",
    kickoff:
      "Please greet me now as a helpful local with your opening line and help me ask for / follow directions.",
    systemInstruction: `You are a helpful local in Korea helping a language learner practice asking for and following directions (landmarks, left/right, subway/bus, how far).

${PARTNER_SHARED_RULES}

Stay in a street / neighborhood scene. Give short, clear directions in Korean. Be encouraging and patient.`,
  },
];

export const scenarioById = Object.fromEntries(
  scenarios.map((s) => [s.id, s]),
) as Record<string, Scenario>;

export function getScenario(id?: string | null): Scenario {
  if (id && scenarioById[id]) return scenarioById[id];
  return scenarios[0];
}

/** @deprecated Prefer getScenario / scenarios — kept for existing imports. */
export const dailyChat = scenarios[0];
