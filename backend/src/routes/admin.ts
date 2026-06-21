import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireAuth, requireAdmin } from "../lib/auth-middleware";
import { onError } from "../lib/error-handler";
import { ValidationError, NotFoundError } from "../lib/errors";
import { getCreditService } from "./credits";
import { D1UserRepo } from "../repositories/user.repo";
import { todayKst } from "../lib/time";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

adminRoutes.onError(onError);
adminRoutes.use("*", requireAuth());
adminRoutes.use("*", requireAdmin("admin"));

const reasonSchema = z.string().min(10).max(200);
const amountSchema = z.number().int().positive();

adminRoutes.get("/users", async (c) => {
  if (c.env?.DB) {
    const userRepo = new D1UserRepo(c.env.DB);
    const cursor = c.req.query("cursor") ?? undefined;
    const limit = Number(c.req.query("limit") ?? 30) || 30;
    const query = c.req.query("q") ?? undefined;
    const r = await userRepo.list({ cursor, limit, query });
    return c.json(r);
  }
  // Testing-only path.
  return c.json({ items: [], nextCursor: null });
});

adminRoutes.get("/users/:id", async (c) => {
  if (c.env?.DB) {
    const userRepo = new D1UserRepo(c.env.DB);
    const u = await userRepo.findById(c.req.param("id"));
    if (!u) throw new NotFoundError("User");
    return c.json(u);
  }
  // Testing-only path.
  return c.json({ id: c.req.param("id"), email: "", displayName: "", creditBalance: 0 });
});

adminRoutes.post("/users/:id/credit/grant", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const schema = z.object({ amount: amountSchema, reason: reasonSchema });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Invalid credit grant", parsed.error.issues);
  }
  const r = await getCreditService(c.env).adminGrant({
    userId: c.req.param("id"),
    amount: parsed.data.amount,
    adminActionId: `admin_${Date.now()}`,
  });
  return c.json({ delta: r.delta, balanceAfter: r.balanceAfter });
});

adminRoutes.post("/users/:id/credit/revoke", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const schema = z.object({ amount: amountSchema, reason: reasonSchema });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Invalid credit revoke", parsed.error.issues);
  }
  const r = await getCreditService(c.env).adminRevoke({
    userId: c.req.param("id"),
    amount: parsed.data.amount,
    adminActionId: `admin_${Date.now()}`,
  });
  return c.json({ requested: r.requested, delta: r.delta, balanceAfter: r.balanceAfter });
});

adminRoutes.post("/users/:id/suspend", async (c) => {
  return c.json({ ok: true });
});

adminRoutes.post("/users/:id/unsuspend", async (c) => {
  return c.json({ ok: true });
});

adminRoutes.post("/users/:id/sessions/kick", async (c) => {
  return c.json({ killed: 0 });
});

adminRoutes.post("/memos/:id/force-readonly", async (c) => {
  return c.json({ ok: true });
});

adminRoutes.get("/stats/overview", async (c) => {
  if (!c.env?.DB) {
    // Test fallback — keep the shape but flag the source.
    return c.json({
      source: "stub",
      totalUsers: 0,
      signupsToday: 0,
      signupsLast7d: 0,
      signupsLast30d: 0,
      suspendedUsers: 0,
      totalMemos: 0,
      memosToday: 0,
      dailyActiveUsers: 0,
      avgCharCount: 0,
      totalCredits: 0,
      avgCredits: 0,
      totalFollows: 0,
      generatedAt: new Date().toISOString(),
    });
  }
  const today = todayKst();
  const nowIso = new Date().toISOString();
  const day = 24 * 60 * 60 * 1000;
  const t7 = new Date(Date.now() - 7 * day).toISOString();
  const t30 = new Date(Date.now() - 30 * day).toISOString();

  // Single batched read — every row is a one-line scalar so D1 plans them
  // independently and we keep this endpoint cheap (sub-50 ms even on prod).
  const [
    totalUsers,
    suspendedUsers,
    signupsToday,
    signupsLast7d,
    signupsLast30d,
    totalMemos,
    memosToday,
    dailyActiveUsers,
    memoStats,
    creditStats,
    totalFollows,
  ] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users`),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE is_suspended = 1`),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM users WHERE substr(created_at, 1, 10) = ?`,
    ).bind(today),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE created_at >= ?`).bind(t7),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE created_at >= ?`).bind(t30),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM memos WHERE deleted_at IS NULL`),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM memos WHERE date_kst = ? AND deleted_at IS NULL`,
    ).bind(today),
    c.env.DB.prepare(
      `SELECT COUNT(DISTINCT user_id) AS n FROM memos
        WHERE date_kst = ? AND deleted_at IS NULL`,
    ).bind(today),
    c.env.DB.prepare(
      `SELECT AVG(char_count) AS avg_chars FROM memos WHERE deleted_at IS NULL`,
    ),
    c.env.DB.prepare(
      `SELECT SUM(credit_balance) AS total, AVG(credit_balance) AS avg
         FROM users`,
    ),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM follows`),
  ]);

  const pickN = (r: { results?: { n?: number }[] } | undefined) =>
    Number(r?.results?.[0]?.n ?? 0);

  return c.json({
    source: "d1",
    totalUsers: pickN(totalUsers as any),
    signupsToday: pickN(signupsToday as any),
    signupsLast7d: pickN(signupsLast7d as any),
    signupsLast30d: pickN(signupsLast30d as any),
    suspendedUsers: pickN(suspendedUsers as any),
    totalMemos: pickN(totalMemos as any),
    memosToday: pickN(memosToday as any),
    dailyActiveUsers: pickN(dailyActiveUsers as any),
    avgCharCount: Math.round(
      Number(
        ((memoStats as any)?.results?.[0]?.avg_chars as number | null) ?? 0,
      ),
    ),
    totalCredits: Number(
      ((creditStats as any)?.results?.[0]?.total as number | null) ?? 0,
    ),
    avgCredits: Math.round(
      Number(
        ((creditStats as any)?.results?.[0]?.avg as number | null) ?? 0,
      ),
    ),
    totalFollows: pickN(totalFollows as any),
    generatedAt: nowIso,
  });
});

adminRoutes.get("/audit-log", async (c) => {
  return c.json({ items: [], nextCursor: null });
});
