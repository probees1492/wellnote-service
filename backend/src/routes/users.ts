import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { onError } from "../lib/error-handler";
import { requireAuth } from "../lib/auth-middleware";
import {
  ConflictError,
  NotFoundError,
  RateLimitedError,
  ValidationError,
} from "../lib/errors";
import { D1UserRepo } from "../repositories/user.repo";
import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  validateDisplayName,
} from "../domain/display-name";
import { memUsers, memUsersByEmail, safeUser } from "./auth";

export const userRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
userRoutes.onError(onError);

/** Minimum interval between consecutive 필명 changes (24 hours). */
const DISPLAY_NAME_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const renameSchema = z.object({
  displayName: z.string().min(DISPLAY_NAME_MIN).max(DISPLAY_NAME_MAX),
});

userRoutes.patch("/me/display-name", requireAuth(), async (c) => {
  const userId = c.get("userId") as string;
  const raw = await c.req.json().catch(() => ({}));
  const parsed = renameSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Invalid payload", parsed.error.issues);
  }
  const nameCheck = validateDisplayName(parsed.data.displayName);
  if (!nameCheck.ok) {
    throw new ValidationError("Invalid display name", {
      field: "displayName",
      reason: nameCheck.reason,
    });
  }
  const nextName = nameCheck.value;

  if (c.env?.DB) {
    const userRepo = new D1UserRepo(c.env.DB);
    const current = await userRepo.findById(userId);
    if (!current) throw new NotFoundError("User");

    // Trivial: same name (case-insensitive) → no-op, no cooldown burned.
    if (current.displayName.toLowerCase() === nextName.toLowerCase()) {
      return c.json({ user: safeUser(current) });
    }

    enforceCooldown(current.displayNameChangedAt);

    const taken = await userRepo.findByDisplayName(nextName);
    if (taken && taken.id !== userId) {
      throw new ConflictError("Display name already in use", {
        field: "displayName",
        reason: "taken",
      });
    }

    const updated = await userRepo.update(userId, {
      displayName: nextName,
      stampDisplayNameChange: true,
    });
    return c.json({ user: safeUser(updated) });
  }

  // Testing-only path.
  const u = memUsers.get(userId);
  if (!u) throw new NotFoundError("User");
  if (u.displayName.toLowerCase() === nextName.toLowerCase()) {
    return c.json({ user: safeUser(u) });
  }
  enforceCooldown(u.displayNameChangedAt);
  const taken = [...memUsersByEmail.values()].find(
    (other) =>
      other.id !== userId &&
      other.displayName.toLowerCase() === nextName.toLowerCase(),
  );
  if (taken) {
    throw new ConflictError("Display name already in use", {
      field: "displayName",
      reason: "taken",
    });
  }
  u.displayName = nextName;
  u.displayNameChangedAt = new Date().toISOString();
  u.updatedAt = u.displayNameChangedAt;
  return c.json({ user: safeUser(u) });
});

function enforceCooldown(changedAt: string | null) {
  if (!changedAt) return;
  const elapsed = Date.now() - Date.parse(changedAt);
  if (Number.isNaN(elapsed)) return;
  if (elapsed >= DISPLAY_NAME_COOLDOWN_MS) return;
  const retryAtMs = Date.parse(changedAt) + DISPLAY_NAME_COOLDOWN_MS;
  throw new RateLimitedError("필명은 24시간에 한 번만 변경할 수 있습니다.", {
    reason: "cooldown",
    retryAt: new Date(retryAtMs).toISOString(),
    remainingMs: DISPLAY_NAME_COOLDOWN_MS - elapsed,
  });
}
