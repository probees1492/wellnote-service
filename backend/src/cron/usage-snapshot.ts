import type { Env } from "../env";
import {
  fetchUsageSnapshot,
  type UsageSnapshot,
} from "../services/cloudflare-analytics.service";

/**
 * Cron handler that pulls Cloudflare GraphQL analytics for the previous
 * 24h (and 30d for R2 storage) and stores the result in KV at a stable
 * key. The admin endpoint reads from this key; the actual GraphQL call
 * happens once per day, well below any rate limit.
 *
 * Required secrets:
 *   - CF_ACCOUNT_ID       (var, not secret — exposed via wrangler.jsonc vars)
 *   - CF_ANALYTICS_TOKEN  (secret — `wrangler secret put`)
 *
 * Without the token the cron is a no-op; the admin UI will surface "—".
 */

export const USAGE_KV_KEY = "admin:usage:latest";
const KV_TTL_SEC = 60 * 60 * 24 * 14;

export interface UsageRecord extends UsageSnapshot {
  /** When the snapshot landed in KV (may differ from generatedAt on retries). */
  storedAt: string;
}

export async function runUsageSnapshot(env: Env): Promise<UsageRecord | null> {
  const token = env?.CF_ANALYTICS_TOKEN;
  const accountId = env?.CF_ACCOUNT_ID;
  if (!token || !accountId) {
    // Soft no-op: log + bail. Cron keeps firing daily so the moment the
    // secret lands, the next run populates KV.
    console.log("[cron] usage-snapshot skipped — CF_ANALYTICS_TOKEN/ID unset");
    return null;
  }
  const snapshot = await fetchUsageSnapshot({ accountId, token });
  const record: UsageRecord = {
    ...snapshot,
    storedAt: new Date().toISOString(),
  };
  if (env.SESSION_KV) {
    try {
      await env.SESSION_KV.put(USAGE_KV_KEY, JSON.stringify(record), {
        expirationTtl: KV_TTL_SEC,
      });
    } catch (e) {
      console.warn("[cron] usage-snapshot KV put failed:", e);
    }
  }
  return record;
}

export async function scheduled(
  _controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const r = await runUsageSnapshot(env);
  console.log(
    "[cron] usage-snapshot",
    r ? JSON.stringify({ generatedAt: r.generatedAt, ok: true }) : "skipped",
  );
}
