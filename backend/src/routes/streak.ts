import { Hono } from "hono";
import type { Env, Variables } from "../env";
import { DefaultStreakService } from "../services/streak.service";
import { D1UserRepo } from "../repositories/user.repo";
import { D1MemoRepo } from "../repositories/memo.repo";
import { D1StreakRepo } from "../repositories/streak.repo";
import { requireAuth } from "../lib/auth-middleware";
import { onError } from "../lib/error-handler";

export const streakRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

streakRoutes.onError(onError);
streakRoutes.use("*", requireAuth());

let _svc: DefaultStreakService | null = null;
export function getStreakService(env: Env | undefined): DefaultStreakService {
  if (_svc) return _svc;
  const userRepo = env?.DB ? new D1UserRepo(env.DB) : ({} as any);
  const memoRepo = env?.DB ? new D1MemoRepo(env.DB) : ({} as any);
  const streakRepo = env?.DB ? new D1StreakRepo(env.DB) : ({} as any);
  _svc = new DefaultStreakService(userRepo, memoRepo, streakRepo);
  return _svc;
}

/** Reset the cached service. Used by tests. */
export function _resetStreakServiceForTests(): void {
  _svc = null;
}

streakRoutes.get("/status", async (c) => {
  const userId = c.get("userId") as string;
  const status = await getStreakService(c.env).getStatus(userId);
  return c.json(status);
});
