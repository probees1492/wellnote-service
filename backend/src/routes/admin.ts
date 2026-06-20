import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { requireAuth, requireAdmin } from "../lib/auth-middleware";
import { onError } from "../lib/error-handler";
import { ValidationError, NotFoundError } from "../lib/errors";
import { getCreditService } from "./credits";
import { D1UserRepo } from "../repositories/user.repo";

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
  return c.json({
    totalUsers: 0,
    dailyActiveUsers: 0,
    memosToday: 0,
    avgCharCount: 0,
    totalCredits: 0,
    avgCredits: 0,
  });
});

adminRoutes.get("/audit-log", async (c) => {
  return c.json({ items: [], nextCursor: null });
});
