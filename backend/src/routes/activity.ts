import { Hono } from "hono";
import type { Env, Variables } from "../env";
import { DefaultActivityService } from "../services/activity.service";
import { D1MemoRepo } from "../repositories/memo.repo";
import { requireAuth } from "../lib/auth-middleware";
import { onError } from "../lib/error-handler";

export const activityRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

activityRoutes.onError(onError);
activityRoutes.use("*", requireAuth());

let _svc: DefaultActivityService | null = null;
function svc(env: Env | undefined): DefaultActivityService {
  if (_svc) return _svc;
  const memoRepo = env?.DB ? new D1MemoRepo(env.DB) : ({} as any);
  _svc = new DefaultActivityService(memoRepo);
  return _svc;
}

activityRoutes.get("/grid", async (c) => {
  const userId = c.get("userId") as string;
  const from = c.req.query("from") ?? undefined;
  const to = c.req.query("to") ?? undefined;
  const r = await svc(c.env).getGrid({ userId, from, to });
  return c.json(r);
});
