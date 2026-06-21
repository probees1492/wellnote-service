/**
 * Topics that classify a daily writing prompt. A user's `topic_preferences`
 * is a JSON-encoded subset of these codes — empty array means "all topics".
 *
 * Codes are short ASCII so they're safe to ship in URLs and KV keys; the
 * native label lives in the client.
 */

export const PROMPT_TOPICS = [
  { code: "daily", ko: "오늘 / 일상" },
  { code: "feeling", ko: "감정 / 마음" },
  { code: "people", ko: "사람 / 관계" },
  { code: "work", ko: "일 / 커리어" },
  { code: "creative", ko: "창작 / 예술" },
  { code: "reflect", ko: "회고 / 성찰" },
  { code: "future", ko: "미래 / 다짐" },
] as const;

export type PromptTopic = (typeof PROMPT_TOPICS)[number]["code"];

const VALID_TOPICS = new Set<string>(PROMPT_TOPICS.map((t) => t.code));

export function isPromptTopic(value: unknown): value is PromptTopic {
  return typeof value === "string" && VALID_TOPICS.has(value);
}

export function parseTopicPreferences(raw: string | null | undefined): PromptTopic[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isPromptTopic);
  } catch {
    return [];
  }
}

/** A single writing-prompt row stored in the daily KV pool. */
export interface DailyPrompt {
  topic: PromptTopic;
  text: string;
}
