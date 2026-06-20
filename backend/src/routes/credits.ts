import { Hono } from "hono";
import type { Env, Variables } from "../env";
import { DefaultCreditService } from "../services/credit.service";
import { D1CreditRepo } from "../repositories/credit.repo";
import { D1UserRepo } from "../repositories/user.repo";
import { requireAuth } from "../lib/auth-middleware";
import { onError } from "../lib/error-handler";

export const creditRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

creditRoutes.onError(onError);
creditRoutes.use("*", requireAuth());

let _svc: DefaultCreditService | null = null;
export function getCreditService(env: Env | undefined): DefaultCreditService {
  if (_svc) return _svc;
  const userRepo = env?.DB ? new D1UserRepo(env.DB) : ({} as any);
  const creditRepo = env?.DB ? new D1CreditRepo(env.DB) : ({} as any);
  _svc = new DefaultCreditService(userRepo, creditRepo);
  return _svc;
}

creditRoutes.get("/balance", async (c) => {
  const userId = c.get("userId") as string;
  const balance = await getCreditService(c.env).getBalance(userId);
  return c.json({ balance });
});

creditRoutes.get("/transactions", async (c) => {
  const userId = c.get("userId") as string;
  const cursor = c.req.query("cursor") ?? undefined;
  const limit = Number(c.req.query("limit") ?? 30) || 30;
  const r = await getCreditService(c.env).listTransactions({
    userId,
    cursor,
    limit,
  });
  return c.json({ items: r.items, nextCursor: r.nextCursor });
});
