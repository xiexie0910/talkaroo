import type { ChatMessage } from "@/components/PartnerPane";

/** Stable-enough id for a chat bubble in the current page session. */
export function msgId(role: "partner" | "user") {
  return `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Immutable update for one message in the thread. */
export function patchMessage(
  messages: ChatMessage[],
  id: string,
  patch: Partial<ChatMessage>,
): ChatMessage[] {
  return messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
}
