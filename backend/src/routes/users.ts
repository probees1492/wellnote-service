import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { onError } from "../lib/error-handler";
import { requireAuth } from "../lib/auth-middleware";
import {
  ConflictError,
  NotFoundError,
  PayloadTooLargeError,
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

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB
const AVATAR_ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function avatarObjectKey(userId: string, ext: string): string {
  return `avatars/${userId}.${ext}`;
}

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

userRoutes.put("/me/avatar", requireAuth(), async (c) => {
  const userId = c.get("userId") as string;
  const contentType = (c.req.header("content-type") ?? "").toLowerCase();
  const baseType = contentType.split(";")[0].trim();
  const ext = AVATAR_ALLOWED_TYPES[baseType];
  if (!ext) {
    throw new ValidationError("Unsupported avatar content-type", {
      field: "contentType",
      allowed: Object.keys(AVATAR_ALLOWED_TYPES),
    });
  }
  const buffer = await c.req.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new ValidationError("Empty avatar body");
  }
  if (buffer.byteLength > AVATAR_MAX_BYTES) {
    throw new PayloadTooLargeError(
      `Avatar exceeds ${AVATAR_MAX_BYTES} bytes`,
    );
  }

  const key = avatarObjectKey(userId, ext);

  if (c.env?.DB && c.env?.MEMO_BUCKET) {
    await c.env.MEMO_BUCKET.put(key, buffer, {
      httpMetadata: { contentType: baseType },
    });
    const userRepo = new D1UserRepo(c.env.DB);
    const updated = await userRepo.setAvatar(userId, {
      objectKey: key,
      contentType: baseType,
    });
    return c.json({ user: safeUser(updated) });
  }

  // Testing-only path: stash the buffer in the mem store.
  const u = memUsers.get(userId);
  if (!u) throw new NotFoundError("User");
  u.avatarObjectKey = key;
  u.avatarContentType = baseType;
  u.avatarUpdatedAt = new Date().toISOString();
  u.updatedAt = u.avatarUpdatedAt;
  memAvatars.set(key, { bytes: new Uint8Array(buffer), contentType: baseType });
  return c.json({ user: safeUser(u) });
});

userRoutes.delete("/me/avatar", requireAuth(), async (c) => {
  const userId = c.get("userId") as string;
  if (c.env?.DB && c.env?.MEMO_BUCKET) {
    const userRepo = new D1UserRepo(c.env.DB);
    const current = await userRepo.findById(userId);
    if (!current) throw new NotFoundError("User");
    if (current.avatarObjectKey) {
      try {
        await c.env.MEMO_BUCKET.delete(current.avatarObjectKey);
      } catch {
        /* best-effort */
      }
    }
    const updated = await userRepo.setAvatar(userId, {
      objectKey: null,
      contentType: null,
    });
    return c.json({ user: safeUser(updated) });
  }
  const u = memUsers.get(userId);
  if (!u) throw new NotFoundError("User");
  if (u.avatarObjectKey) memAvatars.delete(u.avatarObjectKey);
  u.avatarObjectKey = null;
  u.avatarContentType = null;
  u.avatarUpdatedAt = null;
  return c.json({ user: safeUser(u) });
});

// Public avatar read — no auth required so <img src> works without headers.
// Cache-bust is the responsibility of the caller via `?v=avatarUpdatedAt`.
userRoutes.get("/:userId/avatar", async (c) => {
  const userId = c.req.param("userId");
  if (c.env?.DB && c.env?.MEMO_BUCKET) {
    const userRepo = new D1UserRepo(c.env.DB);
    const u = await userRepo.findById(userId);
    if (!u || !u.avatarObjectKey) throw new NotFoundError("Avatar");
    const obj = await c.env.MEMO_BUCKET.get(u.avatarObjectKey);
    if (!obj) throw new NotFoundError("Avatar");
    const buf = await obj.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "content-type":
          u.avatarContentType ?? obj.httpMetadata?.contentType ?? "image/jpeg",
        "cache-control": "public, max-age=3600, immutable",
      },
    });
  }
  // Testing-only path.
  const u = memUsers.get(userId);
  if (!u || !u.avatarObjectKey) throw new NotFoundError("Avatar");
  const entry = memAvatars.get(u.avatarObjectKey);
  if (!entry) throw new NotFoundError("Avatar");
  return new Response(entry.bytes, {
    status: 200,
    headers: {
      "content-type": entry.contentType,
      "cache-control": "public, max-age=3600, immutable",
    },
  });
});

const memAvatars = new Map<string, { bytes: Uint8Array; contentType: string }>();

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
