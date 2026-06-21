import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { DefaultPinService } from "../services/pin.service";
import { D1PinRepo } from "../repositories/pin.repo";
import { D1MemoRepo } from "../repositories/memo.repo";
import { requireAuth } from "../lib/auth-middleware";
import { onError } from "../lib/error-handler";
import { ValidationError } from "../lib/errors";
import { PIN_COLORS, PIN_VISIBILITIES, PIN_NAME_MAX, PIN_NAME_MIN } from "../domain/pin";

export const pinRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

pinRoutes.onError(onError);
pinRoutes.use("*", requireAuth());

let _svc: DefaultPinService | null = null;
export function getPinService(env: Env | undefined): DefaultPinService {
  if (_svc) return _svc;
  const pinRepo = env?.DB ? new D1PinRepo(env.DB) : ({} as any);
  const memoRepo = env?.DB ? new D1MemoRepo(env.DB) : ({} as any);
  _svc = new DefaultPinService(pinRepo, memoRepo);
  return _svc;
}

/** Reset the cached service. Used by tests. */
export function _resetPinServiceForTests(): void {
  _svc = null;
}

const colorEnum = z.enum(PIN_COLORS as unknown as [string, ...string[]]);
const visibilityEnum = z.enum(
  PIN_VISIBILITIES as unknown as [string, ...string[]],
);

const createSchema = z.object({
  name: z.string().min(PIN_NAME_MIN).max(PIN_NAME_MAX),
  color: colorEnum.optional(),
  visibility: visibilityEnum.optional(),
});

const patchSchema = z
  .object({
    name: z.string().min(PIN_NAME_MIN).max(PIN_NAME_MAX).optional(),
    color: colorEnum.optional(),
    visibility: visibilityEnum.optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.color !== undefined ||
      v.visibility !== undefined,
    "At least one field is required",
  );

pinRoutes.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const items = await getPinService(c.env).listPins(userId);
  return c.json({ items });
});

pinRoutes.post("/", async (c) => {
  const userId = c.get("userId") as string;
  const raw = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Invalid pin payload", parsed.error.issues);
  }
  const pin = await getPinService(c.env).createPin({
    userId,
    name: parsed.data.name,
    color: parsed.data.color as any,
    visibility: parsed.data.visibility as any,
  });
  return c.json(pin);
});

pinRoutes.get("/:id/memos", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const cursor = c.req.query("cursor") ?? undefined;
  const limit = Number(c.req.query("limit") ?? 30) || 30;
  const r = await getPinService(c.env).listPinMemos({
    userId,
    pinId: id,
    cursor,
    limit,
  });
  return c.json(r);
});

pinRoutes.get("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const pin = await getPinService(c.env).getPin(userId, id);
  return c.json(pin);
});

pinRoutes.patch("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const raw = await c.req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Invalid pin patch", parsed.error.issues);
  }
  const pin = await getPinService(c.env).updatePin(userId, id, {
    name: parsed.data.name,
    color: parsed.data.color as any,
    visibility: parsed.data.visibility as any,
  });
  return c.json(pin);
});

pinRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  await getPinService(c.env).deletePin(userId, id);
  return c.json({ ok: true });
});
