import {
  PROMPT_TOPICS,
  type DailyPrompt,
  type PromptTopic,
} from "../domain/prompt-topic";

/**
 * Workers AI-backed writing-prompt generator. Calls Qwen2.5-7B-Instruct
 * (free tier), validates each prompt against a strict allow-list of Korean +
 * basic punctuation, and returns only the rows that survive.
 *
 * Failure modes are absorbed: a topic that produces zero valid prompts is
 * just omitted from the day's pool. The cron caller decides whether to fall
 * back to an empty pool or the previous day's cached entry.
 */

const MODEL = "@cf/qwen/qwen2.5-coder-32b-instruct"; // upgraded variant; if absent
//                                                       fall back to 7b instruct
const FALLBACK_MODEL = "@cf/qwen/qwen2.5-7b-instruct";
const PROMPTS_PER_TOPIC = 8;

// Allowed Unicode: Hangul syllables + Hangul Jamo + ASCII printable + common
// punctuation. Anything outside is rejected as a tokenizer / language-drift
// artifact (most often Chinese hanzi `\u4E00-\u9FFF`).
const ALLOWED = /^[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\u0020-\u007E\u00A0-\u00FF·…—–"'?!.,()\[\]/:;]+$/u;

// Explicit blacklist of chars Qwen tends to leak even when we ask it not to.
const BANNED = /[\u4E00-\u9FFF\u3400-\u4DBF\uFFFD\u2581\u200B-\u200D\uFE00-\uFE0F]/u;

const MIN_LEN = 8;
const MAX_LEN = 60;

export interface AIBinding {
  run(
    model: string,
    inputs: {
      messages: { role: "system" | "user" | "assistant"; content: string }[];
      max_tokens?: number;
      temperature?: number;
      response_format?: { type: "json_object" | "json_schema"; json_schema?: unknown };
    },
  ): Promise<{ response?: string } | Record<string, unknown>>;
}

export function cleanPrompt(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  if (trimmed.length < MIN_LEN || trimmed.length > MAX_LEN) return null;
  if (BANNED.test(trimmed)) return null;
  if (!ALLOWED.test(trimmed)) return null;
  // Must contain at least one Hangul syllable — pure ASCII slips through the
  // whitelist otherwise (e.g. tokenizer leak that's just punctuation).
  if (!/[\uAC00-\uD7AF]/.test(trimmed)) return null;
  return trimmed;
}

function topicSystemPrompt(topic: PromptTopic, ko: string): string {
  return [
    "당신은 일기 작성용 마중물 문장을 만드는 도우미입니다.",
    `주제: ${ko}`,
    "규칙:",
    " - 반드시 한국어로만 출력. 한자(漢字), 영어 단어, 이모지, 마크다운 금지.",
    " - 각 문장은 8자 이상 50자 이하의 짧은 질문 또는 미완성 문장.",
    " - 너무 추상적이거나 어색하지 않게. 일상에서 떠올릴 수 있는 구체적 단서.",
    " - 동어반복, 흔한 격언, 명령형 금지.",
    `정확히 ${PROMPTS_PER_TOPIC}개의 문장을 JSON 배열만으로 반환:`,
    `{"prompts": ["문장1", "문장2", ...]}`,
  ].join("\n");
}

function extractStringArray(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  // Workers AI returns either { response: "...json..." } or the parsed object.
  if (typeof obj.response === "string") {
    try {
      const parsed = JSON.parse(obj.response);
      const arr = (parsed?.prompts ?? parsed?.items ?? parsed) as unknown;
      return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === "string") : [];
    } catch {
      // Sometimes the model wraps JSON in a code fence — strip and retry.
      const fenced = obj.response.match(/```(?:json)?\s*([\s\S]+?)```/);
      if (fenced) {
        try {
          const parsed = JSON.parse(fenced[1]);
          const arr = (parsed?.prompts ?? parsed?.items ?? parsed) as unknown;
          return Array.isArray(arr)
            ? arr.filter((s): s is string => typeof s === "string")
            : [];
        } catch {
          return [];
        }
      }
      return [];
    }
  }
  const prompts = obj.prompts;
  if (Array.isArray(prompts)) {
    return prompts.filter((s): s is string => typeof s === "string");
  }
  return [];
}

async function runWithFallback(
  ai: AIBinding,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
): Promise<string[]> {
  const inputs = {
    messages,
    max_tokens: 600,
    temperature: 0.6,
    response_format: { type: "json_object" as const },
  };
  try {
    const r = await ai.run(MODEL, inputs);
    const arr = extractStringArray(r);
    if (arr.length > 0) return arr;
  } catch {
    // fall through to the smaller model
  }
  try {
    const r2 = await ai.run(FALLBACK_MODEL, inputs);
    return extractStringArray(r2);
  } catch {
    return [];
  }
}

export async function generateDailyPromptPool(
  ai: AIBinding,
): Promise<DailyPrompt[]> {
  const out: DailyPrompt[] = [];
  for (const topic of PROMPT_TOPICS) {
    const messages = [
      { role: "system" as const, content: topicSystemPrompt(topic.code, topic.ko) },
      { role: "user" as const, content: `주제 "${topic.ko}"로 ${PROMPTS_PER_TOPIC}개 문장 생성.` },
    ];
    const raws = await runWithFallback(ai, messages);
    for (const raw of raws) {
      const cleaned = cleanPrompt(raw);
      if (cleaned) out.push({ topic: topic.code, text: cleaned });
    }
  }
  return out;
}
