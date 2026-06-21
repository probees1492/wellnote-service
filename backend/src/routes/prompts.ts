import { Hono } from "hono";
import type { Env, Variables } from "../env";
import { onError } from "../lib/error-handler";
import { requireAuth } from "../lib/auth-middleware";
import { D1UserRepo } from "../repositories/user.repo";
import {
  isPromptTopic,
  parseTopicPreferences,
  PROMPT_TOPICS,
  type DailyPrompt,
  type PromptTopic,
} from "../domain/prompt-topic";
import { poolKey } from "../cron/daily-prompts";
import { toDateKst, previousDateKst } from "../lib/time";
import { memUsers } from "./auth";
import { ValidationError } from "../lib/errors";

export const promptRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
promptRoutes.onError(onError);

const STATIC_FALLBACK: DailyPrompt[] = [
  { topic: "daily", text: "오늘 처음 떠오른 생각은?" },
  { topic: "feeling", text: "오늘 마음에 가장 오래 남은 한 장면." },
  { topic: "people", text: "오늘 누군가에게 못 한 말이 있다면." },
  { topic: "reflect", text: "오늘의 나에게 점수를 준다면?" },
  { topic: "future", text: "내일의 나에게 한마디." },
];

async function loadPool(env: Env, dateKst: string): Promise<DailyPrompt[]> {
  if (!env?.SESSION_KV) return [];
  try {
    const raw = await env.SESSION_KV.get(poolKey(dateKst));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is DailyPrompt =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as DailyPrompt).text === "string" &&
        isPromptTopic((p as DailyPrompt).topic),
    );
  } catch {
    return [];
  }
}

/** GET /prompts/today — returns the day's pool filtered by user preferences. */
promptRoutes.get("/today", requireAuth(), async (c) => {
  const userId = c.get("userId") as string;
  const now = new Date();
  const dateKst = toDateKst(now);

  let prefs: PromptTopic[] = [];
  if (c.env?.DB) {
    const userRepo = new D1UserRepo(c.env.DB);
    const u = await userRepo.findById(userId);
    if (u) prefs = parseTopicPreferences(u.topicPreferences ?? "[]");
  } else {
    const mu = memUsers.get(userId);
    if (mu) prefs = parseTopicPreferences(mu.topicPreferences ?? "[]");
  }

  let pool = await loadPool(c.env, dateKst);
  // Yesterday's pool acts as a stale-but-acceptable cache while the next
  // cron run fills today's KV slot.
  if (pool.length === 0) {
    pool = await loadPool(c.env, previousDateKst(dateKst));
  }
  if (pool.length === 0) pool = STATIC_FALLBACK;

  const filtered = prefs.length === 0
    ? pool
    : pool.filter((p) => prefs.includes(p.topic));
  const items = filtered.length > 0 ? filtered : pool;

  return c.json({
    dateKst,
    appliedTopics: prefs,
    items,
    topics: PROMPT_TOPICS.map((t) => ({ code: t.code, ko: t.ko })),
  });
});

/** PUT /prompts/preferences — updates the caller's topic preferences. */
promptRoutes.put("/preferences", requireAuth(), async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json().catch(() => ({}));
  const arr = Array.isArray((body as { topics?: unknown }).topics)
    ? (body as { topics: unknown[] }).topics
    : [];
  const cleaned = Array.from(
    new Set(arr.filter(isPromptTopic) as PromptTopic[]),
  );
  if (cleaned.length > PROMPT_TOPICS.length) {
    throw new ValidationError("Too many topics");
  }
  const json = JSON.stringify(cleaned);

  if (c.env?.DB) {
    await c.env.DB.prepare(
      `UPDATE users SET topic_preferences = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(json, new Date().toISOString(), userId)
      .run();
  } else {
    const mu = memUsers.get(userId);
    if (mu) mu.topicPreferences = json;
  }
  return c.json({ topics: cleaned });
});
