import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "../env";
import { onError } from "../lib/error-handler";
import { requireAuth } from "../lib/auth-middleware";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../lib/errors";
import { D1UserRepo } from "../repositories/user.repo";
import { D1BuddyRepo, InMemoryBuddyRepo, type BuddyRepo } from "../repositories/buddy.repo";
import type { BuddyProfile } from "../domain/buddy";
import { isFollowingVisibility } from "../domain/buddy";
import type { User } from "../domain/user";
import { memUsers } from "./auth";
import { getMemoService } from "./memos";

export const buddyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
buddyRoutes.onError(onError);

// Tests + local dev (no D1 binding) share a single in-memory graph keyed by
// the auth-route memUsers map. Production overrides this with D1BuddyRepo.
const memBuddyRepo = new InMemoryBuddyRepo();
export function _resetBuddyRepoForTests(): void {
  // Replace the in-memory rows with an empty graph between tests.
  (memBuddyRepo as unknown as { rows: never[] }).rows = [];
}

function repos(env: Env | undefined):
  | { mode: "d1"; users: D1UserRepo; buddies: D1BuddyRepo }
  | { mode: "mem"; buddies: BuddyRepo } {
  if (env?.DB) {
    return {
      mode: "d1",
      users: new D1UserRepo(env.DB),
      buddies: new D1BuddyRepo(env.DB),
    };
  }
  return { mode: "mem", buddies: memBuddyRepo };
}

function memUser(id: string): User | null {
  const u = memUsers.get(id);
  if (!u) return null;
  return {
    ...u,
    streakLastDay: u.streakLastDay ?? null,
    streakFreezes: u.streakFreezes ?? 1,
    avatarObjectKey: u.avatarObjectKey,
    avatarContentType: u.avatarContentType,
    avatarUpdatedAt: u.avatarUpdatedAt,
    topicPreferences: u.topicPreferences,
    followerCount: u.followerCount,
    followingCount: u.followingCount,
    followingVisibility: u.followingVisibility,
    displayNameChangedAt: u.displayNameChangedAt,
  };
}

function memSearch(query: string, excludeId: string): User[] {
  const lower = query.toLowerCase();
  return [...memUsers.values()]
    .filter((u) => u.id !== excludeId && !u.isSuspended)
    .filter((u) => u.displayName.toLowerCase().startsWith(lower))
    .slice(0, 20)
    .map((u) => memUser(u.id)!)
    .filter(Boolean);
}

/** Build a viewer-aware profile snapshot for a buddy lookup result. */
async function toProfile(
  user: User,
  viewerId: string,
  buddies: BuddyRepo,
): Promise<BuddyProfile> {
  const isSelf = user.id === viewerId;
  const [isFollowing, isFollower] = isSelf
    ? [false, false]
    : await Promise.all([
        buddies.exists(viewerId, user.id),
        buddies.exists(user.id, viewerId),
      ]);
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUpdatedAt
      ? `/users/${user.id}/avatar?v=${encodeURIComponent(user.avatarUpdatedAt)}`
      : null,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    followingVisibility: user.followingVisibility,
    isFollowing,
    isFollower,
    isSelf,
  };
}

/**
 * GET /buddies/search?q=...
 * Returns up to 20 users whose display_name starts with the query (case-
 * insensitive). The caller is filtered out. Each result is annotated with the
 * viewer's relationship.
 */
buddyRoutes.get("/search", requireAuth(), async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (q.length === 0) return c.json({ items: [] });
  const viewerId = c.get("userId") as string;
  const r = repos(c.env);
  const matches =
    r.mode === "d1"
      ? await r.users.searchByDisplayName(q, { limit: 20, excludeId: viewerId })
      : memSearch(q, viewerId);
  const items = await Promise.all(
    matches.map((u) => toProfile(u, viewerId, r.buddies)),
  );
  return c.json({ items });
});

/** POST /buddies/follow/:userId — idempotent follow. */
buddyRoutes.post("/follow/:userId", requireAuth(), async (c) => {
  const viewerId = c.get("userId") as string;
  const target = c.req.param("userId");
  if (target === viewerId) {
    throw new ValidationError("Cannot follow yourself");
  }
  const r = repos(c.env);
  const targetUser =
    r.mode === "d1" ? await r.users.findById(target) : memUser(target);
  if (!targetUser) throw new NotFoundError("User");
  await r.buddies.follow(viewerId, target);
  if (r.mode === "mem") {
    // Maintain cached counts on memUsers to mirror the SQL trigger above.
    const target = memUsers.get(targetUser.id);
    const viewer = memUsers.get(viewerId);
    if (target) target.followerCount += 1;
    if (viewer) viewer.followingCount += 1;
  }
  const refreshed =
    r.mode === "d1" ? await r.users.findById(target) : memUser(targetUser.id);
  const profile = await toProfile(refreshed ?? targetUser, viewerId, r.buddies);
  return c.json({ buddy: profile });
});

/** DELETE /buddies/follow/:userId — idempotent unfollow. */
buddyRoutes.delete("/follow/:userId", requireAuth(), async (c) => {
  const viewerId = c.get("userId") as string;
  const target = c.req.param("userId");
  const r = repos(c.env);
  const targetUser =
    r.mode === "d1" ? await r.users.findById(target) : memUser(target);
  if (!targetUser) throw new NotFoundError("User");
  const removed = await r.buddies.unfollow(viewerId, target);
  if (r.mode === "mem" && removed) {
    const t = memUsers.get(targetUser.id);
    const v = memUsers.get(viewerId);
    if (t) t.followerCount = Math.max(0, t.followerCount - 1);
    if (v) v.followingCount = Math.max(0, v.followingCount - 1);
  }
  const refreshed =
    r.mode === "d1" ? await r.users.findById(target) : memUser(targetUser.id);
  const profile = await toProfile(refreshed ?? targetUser, viewerId, r.buddies);
  return c.json({ buddy: profile });
});

/** GET /buddies/me/following — my following list. */
buddyRoutes.get("/me/following", requireAuth(), async (c) => {
  const viewerId = c.get("userId") as string;
  const cursor = c.req.query("cursor") ?? undefined;
  const r = repos(c.env);
  const page = await r.buddies.listFollowing(viewerId, { cursor });
  const items = await hydrateProfiles(page.items, viewerId, r);
  return c.json({ items, nextCursor: page.nextCursor });
});

/** GET /buddies/me/followers — users following me. */
buddyRoutes.get("/me/followers", requireAuth(), async (c) => {
  const viewerId = c.get("userId") as string;
  const cursor = c.req.query("cursor") ?? undefined;
  const r = repos(c.env);
  const page = await r.buddies.listFollowers(viewerId, { cursor });
  const items = await hydrateProfiles(page.items, viewerId, r);
  return c.json({ items, nextCursor: page.nextCursor });
});

/** PUT /buddies/me/visibility — flip the following-list visibility. */
const visibilitySchema = z.object({
  followingVisibility: z.enum(["public", "private"]),
});
buddyRoutes.put("/me/visibility", requireAuth(), async (c) => {
  const viewerId = c.get("userId") as string;
  const raw = await c.req.json().catch(() => ({}));
  const parsed = visibilitySchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Invalid visibility", parsed.error.issues);
  }
  if (!isFollowingVisibility(parsed.data.followingVisibility)) {
    throw new ValidationError("Invalid visibility");
  }
  if (c.env?.DB) {
    const userRepo = new D1UserRepo(c.env.DB);
    await userRepo.setFollowingVisibility(
      viewerId,
      parsed.data.followingVisibility,
    );
  } else {
    const mu = memUsers.get(viewerId);
    if (mu) mu.followingVisibility = parsed.data.followingVisibility;
  }
  return c.json({ followingVisibility: parsed.data.followingVisibility });
});

interface FeedItem {
  memoId: string;
  ownerId: string;
  ownerDisplayName: string;
  ownerAvatarUrl: string | null;
  dateKst: string;
  title: string;
  charCount: number;
  pinId: string;
  pinName: string;
  pinColor: string;
  createdAt: string;
  updatedAt: string;
}

interface FeedRow {
  memo_id: string;
  owner_id: string;
  owner_display_name: string;
  owner_avatar_updated_at: string | null;
  date_kst: string;
  title: string;
  char_count: number;
  pin_id: string;
  pin_name: string;
  pin_color: string;
  created_at: string;
  updated_at: string;
}

/**
 * GET /buddies/feed — paginated metadata of public-pin memos from users the
 * viewer follows. Most-recently-updated first. Body is fetched separately
 * via /buddies/memos/:memoId.
 *
 * NOTE: must be registered BEFORE the catch-all /:userId route below, or
 * Hono's matcher will treat "feed" as a user id.
 */
buddyRoutes.get("/feed", requireAuth(), async (c) => {
  const viewerId = c.get("userId") as string;
  const cursor = c.req.query("cursor") ?? undefined;
  const limit = Math.max(1, Math.min(Number(c.req.query("limit") ?? 20) || 20, 50));

  if (!c.env?.DB) {
    return c.json({ items: [], nextCursor: null });
  }

  const binds: unknown[] = [viewerId];
  let where = `f.follower_id = ?
               AND p.visibility = 'public'
               AND m.deleted_at IS NULL`;
  if (cursor) {
    where += " AND m.updated_at < ?";
    binds.push(cursor);
  }
  binds.push(limit + 1);

  const sql = `
    SELECT
      m.id           AS memo_id,
      m.user_id      AS owner_id,
      u.display_name AS owner_display_name,
      u.avatar_updated_at AS owner_avatar_updated_at,
      m.date_kst     AS date_kst,
      m.title        AS title,
      m.char_count   AS char_count,
      p.id           AS pin_id,
      p.name         AS pin_name,
      p.color        AS pin_color,
      m.created_at   AS created_at,
      m.updated_at   AS updated_at
    FROM follows f
    JOIN memos m ON m.user_id = f.followee_id
    JOIN pins  p ON p.id = m.pin_id
    JOIN users u ON u.id = m.user_id
    WHERE ${where}
    ORDER BY m.updated_at DESC
    LIMIT ?`;

  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds)
    .all<FeedRow>();
  const rows = results ?? [];
  const items: FeedItem[] = rows.slice(0, limit).map((r) => ({
    memoId: r.memo_id,
    ownerId: r.owner_id,
    ownerDisplayName: r.owner_display_name,
    ownerAvatarUrl: r.owner_avatar_updated_at
      ? `/users/${r.owner_id}/avatar?v=${encodeURIComponent(
          r.owner_avatar_updated_at,
        )}`
      : null,
    dateKst: r.date_kst,
    title: r.title,
    charCount: r.char_count,
    pinId: r.pin_id,
    pinName: r.pin_name,
    pinColor: r.pin_color,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  const nextCursor =
    rows.length > limit ? items[items.length - 1].updatedAt : null;
  return c.json({ items, nextCursor });
});

/**
 * GET /buddies/memos/:memoId — full body of a memo IF it sits in a public
 * pin. Reachable by any authenticated user; the public-pin attribution acts
 * as the access-control flag (spec: "공개된 핀 글").
 *
 * Registered BEFORE /:userId for the same matcher-precedence reason as /feed.
 */
buddyRoutes.get("/memos/:memoId", requireAuth(), async (c) => {
  const memoId = c.req.param("memoId");
  if (!c.env?.DB) throw new NotFoundError("Memo");
  const row = await c.env.DB.prepare(
    `SELECT m.user_id AS owner_id, p.visibility AS pin_visibility,
            p.id AS pin_id, p.name AS pin_name, p.color AS pin_color
       FROM memos m
       LEFT JOIN pins p ON p.id = m.pin_id
       WHERE m.id = ? AND m.deleted_at IS NULL`,
  )
    .bind(memoId)
    .first<{
      owner_id: string;
      pin_visibility: string | null;
      pin_id: string | null;
      pin_name: string | null;
      pin_color: string | null;
    }>();
  if (!row) throw new NotFoundError("Memo");
  const viewerId = c.get("userId") as string;
  if (row.owner_id !== viewerId && row.pin_visibility !== "public") {
    throw new ForbiddenError("Memo is not public");
  }
  const memo = await getMemoService(c.env).loadForRead(memoId);
  if (!memo) throw new NotFoundError("Memo");
  return c.json({
    memo,
    owner: { id: row.owner_id },
    pin:
      row.pin_id !== null
        ? {
            id: row.pin_id,
            name: row.pin_name,
            color: row.pin_color,
            visibility: row.pin_visibility,
          }
        : null,
  });
});

/** GET /buddies/:userId — public profile snapshot. (Keep this AFTER the static
 *  /me/* + /feed + /memos/* routes so Hono's matcher doesn't capture them.) */
buddyRoutes.get("/:userId", requireAuth(), async (c) => {
  const viewerId = c.get("userId") as string;
  const target = c.req.param("userId");
  const r = repos(c.env);
  const targetUser =
    r.mode === "d1" ? await r.users.findById(target) : memUser(target);
  if (!targetUser) throw new NotFoundError("User");
  const profile = await toProfile(targetUser, viewerId, r.buddies);
  return c.json({ buddy: profile });
});

/**
 * GET /buddies/:userId/following — that user's following list. 403 when the
 * user has hidden their list and the viewer isn't them.
 */
buddyRoutes.get("/:userId/following", requireAuth(), async (c) => {
  const viewerId = c.get("userId") as string;
  const target = c.req.param("userId");
  const cursor = c.req.query("cursor") ?? undefined;
  const r = repos(c.env);
  const targetUser =
    r.mode === "d1" ? await r.users.findById(target) : memUser(target);
  if (!targetUser) throw new NotFoundError("User");
  if (
    targetUser.followingVisibility === "private" &&
    targetUser.id !== viewerId
  ) {
    throw new ForbiddenError("Following list is private");
  }
  const page = await r.buddies.listFollowing(target, { cursor });
  const items = await hydrateProfiles(page.items, viewerId, r);
  return c.json({ items, nextCursor: page.nextCursor });
});

async function hydrateProfiles(
  items: { userId: string; createdAt: string }[],
  viewerId: string,
  r: ReturnType<typeof repos>,
): Promise<BuddyProfile[]> {
  const out: BuddyProfile[] = [];
  for (const it of items) {
    const u =
      r.mode === "d1" ? await r.users.findById(it.userId) : memUser(it.userId);
    if (u) out.push(await toProfile(u, viewerId, r.buddies));
  }
  return out;
}
