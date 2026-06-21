import type { Env } from "../env";
import { generateDailyPromptPool } from "../services/prompt-generation.service";
import { toDateKst } from "../lib/time";
import type { DailyPrompt } from "../domain/prompt-topic";
import { runUsageSnapshot } from "./usage-snapshot";

const KV_PREFIX = "prompt-pool:";
const KV_TTL_SEC = 60 * 60 * 24 * 14; // keep 2 weeks of history for debugging
const FALLBACK_POOL: DailyPrompt[] = [
  { topic: "daily", text: "오늘 처음 떠오른 생각은?" },
  { topic: "daily", text: "지금 내 책상 위에 보이는 것 한 가지." },
  { topic: "feeling", text: "오늘 마음에 가장 오래 남은 한 장면." },
  { topic: "feeling", text: "오늘 하루를 한 단어로 요약하면?" },
  { topic: "people", text: "오늘 누군가에게 못 한 말이 있다면." },
  { topic: "people", text: "오늘 만난 사람 중 가장 기억나는 한 사람." },
  { topic: "work", text: "오늘 끝낸 일 한 가지를 적어보자." },
  { topic: "work", text: "내일 가장 먼저 하고 싶은 일은?" },
  { topic: "creative", text: "오늘 들은 소리 중 가장 좋았던 한 가지." },
  { topic: "creative", text: "지금 떠오르는 짧은 문장을 하나만." },
  { topic: "reflect", text: "어제와 다르게 시작한 일이 있다면." },
  { topic: "reflect", text: "오늘의 나에게 점수를 준다면?" },
  { topic: "future", text: "내일의 나에게 한마디." },
  { topic: "future", text: "이번 주에 꼭 해보고 싶은 한 가지." },
];

export function poolKey(dateKst: string): string {
  return `${KV_PREFIX}${dateKst}`;
}

export interface DailyPromptsResult {
  dateKst: string;
  generated: number;
  stored: number;
  modelOk: boolean;
  errors: string[];
}

export async function runDailyPrompts(
  env: Env,
  now: Date = new Date(),
): Promise<DailyPromptsResult> {
  const dateKst = toDateKst(now);
  const result: DailyPromptsResult = {
    dateKst,
    generated: 0,
    stored: 0,
    modelOk: false,
    errors: [],
  };
  let pool: DailyPrompt[] = [];
  try {
    pool = await generateDailyPromptPool(env.AI);
    result.generated = pool.length;
    result.modelOk = pool.length > 0;
  } catch (e) {
    result.errors.push(`generate: ${(e as Error).message ?? e}`);
  }
  // Fall back so we always serve *something* if the model burped.
  if (pool.length < FALLBACK_POOL.length) {
    pool = [...pool, ...FALLBACK_POOL];
  }
  // De-duplicate by text (Qwen sometimes repeats across topics).
  const seen = new Set<string>();
  pool = pool.filter((p) => {
    if (seen.has(p.text)) return false;
    seen.add(p.text);
    return true;
  });
  try {
    await env.SESSION_KV.put(poolKey(dateKst), JSON.stringify(pool), {
      expirationTtl: KV_TTL_SEC,
    });
    result.stored = pool.length;
  } catch (e) {
    result.errors.push(`kv-put: ${(e as Error).message ?? e}`);
  }
  return result;
}

export async function scheduled(
  _controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  // Cloudflare's free plan caps the *account* at 5 cron triggers total, so
  // we piggyback the daily Cloudflare usage snapshot onto this 04:00 KST
  // run instead of registering a third cron string.
  const promptResult = await runDailyPrompts(env);
  console.log("[cron] daily-prompts", JSON.stringify(promptResult));
  try {
    const usage = await runUsageSnapshot(env);
    console.log(
      "[cron] usage-snapshot (piggybacked)",
      usage
        ? JSON.stringify({ generatedAt: usage.generatedAt, ok: true })
        : "skipped",
    );
  } catch (e) {
    console.warn("[cron] usage-snapshot failed:", e);
  }
}
