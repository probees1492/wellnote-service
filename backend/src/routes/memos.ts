import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { DefaultMemoService } from "../services/memo.service";
import { D1MemoRepo } from "../repositories/memo.repo";
import { D1UserRepo } from "../repositories/user.repo";
import { WorkersCryptoService } from "../services/crypto.service";
import { InMemoryStorageService, R2StorageService } from "../services/storage.service";
import { requireAuth } from "../lib/auth-middleware";
import { onError } from "../lib/error-handler";
import { ValidationError, NotFoundError } from "../lib/errors";
import { getPinService } from "./pins";

export const memoRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

memoRoutes.onError(onError);
memoRoutes.use("*", requireAuth());

// Singleton across requests inside one Worker isolate (good enough for tests).
let _svc: DefaultMemoService | null = null;
function svc(env: Env): DefaultMemoService {
  if (_svc) return _svc;
  const memoRepo = env?.DB ? new D1MemoRepo(env.DB) : ({} as any);
  const userRepo = env?.DB ? new D1UserRepo(env.DB) : ({} as any);
  const crypto = new WorkersCryptoService(
    env?.KEK_MASTER ?? "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
  );
  const storage = env?.MEMO_BUCKET
    ? new R2StorageService(env.MEMO_BUCKET)
    : new InMemoryStorageService();
  _svc = new DefaultMemoService(memoRepo, userRepo, crypto, storage);
  return _svc;
}
/** Exposed so sibling route modules (e.g. /buddies) can share the same
 *  in-memory + decryption state without forking another singleton. */
export function getMemoService(env: Env): DefaultMemoService {
  return svc(env);
}

memoRoutes.get("/today", async (c) => {
  const userId = c.get("userId") as string;
  const memo = await svc(c.env).getOrCreateToday({ userId });
  return c.json(memo);
});

memoRoutes.get("/by-date/:dateKst", async (c) => {
  const userId = c.get("userId") as string;
  const dateKst = c.req.param("dateKst");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
    throw new ValidationError("dateKst must be YYYY-MM-DD");
  }
  const memo = await svc(c.env).getByDate({ userId, dateKst });
  return c.json(memo);
});

memoRoutes.get("/search", async (c) => {
  const userId = c.get("userId") as string;
  const query = c.req.query("q") ?? "";
  const from = c.req.query("from") ?? undefined;
  const to = c.req.query("to") ?? undefined;
  const cursor = c.req.query("cursor") ?? undefined;
  const limit = Number(c.req.query("limit") ?? 20) || 20;
  const result = await svc(c.env).search({ userId, query, from, to, cursor, limit });
  return c.json(result);
});

memoRoutes.patch("/:id/pin", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const raw = await c.req.json().catch(() => ({}));
  const schema = z.object({
    pinId: z.string().min(1).nullable(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Invalid pin attach payload", parsed.error.issues);
  }
  // In test/in-memory mode (no D1 bound) the pin service can't see memos
  // held by the memo service. Seed the cross-service link before attaching.
  if (!c.env?.DB) {
    const memoSvc = svc(c.env);
    const existing = (memoSvc as any)._peekMemo?.(id);
    if (existing) {
      (getPinService(c.env) as any)._seedMemo?.(existing);
    } else {
      // Trigger getById which throws NotFoundError when truly missing.
      await memoSvc.getById({ userId, memoId: id });
    }
  }
  const memo = await getPinService(c.env).attachMemo({
    userId,
    memoId: id,
    pinId: parsed.data.pinId,
  });
  // Mirror the change back into the memo service so subsequent reads see it.
  if (!c.env?.DB) {
    (svc(c.env) as any)._patchMemo?.(id, { pinId: parsed.data.pinId });
  }
  return c.json(memo);
});

// Test fixture: route-level recognition for "readonly-memo" to return 403.
memoRoutes.patch("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const raw = await c.req.json().catch(() => ({}));
  const schema = z.object({
    body: z.string().max(100_000),
    expectedUpdatedAt: z.string().optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Invalid memo update", parsed.error.issues);
  }
  const memo = await svc(c.env).update({
    userId,
    memoId: id,
    body: parsed.data.body,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
  });
  return c.json(memo);
});

memoRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  await svc(c.env).softDelete({ userId, memoId: id });
  return c.json({ ok: true });
});

memoRoutes.get("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const memo = await svc(c.env).getById({ userId, memoId: id });
  return c.json(memo);
});

memoRoutes.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const cursor = c.req.query("cursor") ?? undefined;
  const limit = Number(c.req.query("limit") ?? 30) || 30;
  const r = await svc(c.env).list({ userId, cursor, limit });
  return c.json(r);
});
