import { Hono } from "hono";
import type { Env, Variables } from "../env";
import { onError } from "../lib/error-handler";
import { requireAuth } from "../lib/auth-middleware";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../lib/errors";
import {
  COMMENT_MAX,
  type MemoComment,
  type ReactionTally,
  isAllowedEmoji,
  sanitizeComment,
} from "../domain/memo-interaction";

export const interactionRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
interactionRoutes.onError(onError);

interface MemoLookup {
  ownerId: string;
  pinVisibility: string | null;
  exists: boolean;
}

async function loadMemoMeta(
  env: Env,
  memoId: string,
): Promise<MemoLookup | null> {
  if (!env?.DB) return null;
  const row = await env.DB.prepare(
    `SELECT m.user_id AS owner_id, p.visibility AS pin_visibility
       FROM memos m
       LEFT JOIN pins p ON p.id = m.pin_id
       WHERE m.id = ? AND m.deleted_at IS NULL`,
  )
    .bind(memoId)
    .first<{ owner_id: string; pin_visibility: string | null }>();
  if (!row) return null;
  return {
    ownerId: row.owner_id,
    pinVisibility: row.pin_visibility,
    exists: true,
  };
}

/** A memo accepts reactions/comments if caller is owner OR pin is public. */
function assertInteractable(meta: MemoLookup, viewerId: string): void {
  if (meta.ownerId === viewerId) return;
  if (meta.pinVisibility !== "public") {
    throw new ForbiddenError("Memo is not public");
  }
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

/** POST /memos/:memoId/reactions { emoji } — adds a reaction (idempotent). */
interactionRoutes.post("/memos/:memoId/reactions", requireAuth(), async (c) => {
  const viewerId = c.get("userId") as string;
  const memoId = c.req.param("memoId");
  const body = await c.req.json().catch(() => ({}));
  const emoji = (body as { emoji?: unknown }).emoji;
  if (!isAllowedEmoji(emoji)) {
    throw new ValidationError("Invalid emoji");
  }
  if (!c.env?.DB) throw new NotFoundError("Database");
  const meta = await loadMemoMeta(c.env, memoId);
  if (!meta) throw new NotFoundError("Memo");
  assertInteractable(meta, viewerId);

  const now = new Date().toISOString();
  try {
    await c.env.DB.prepare(
      `INSERT INTO memo_reactions (id, memo_id, user_id, emoji, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(newId("rxn"), memoId, viewerId, emoji, now)
      .run();
  } catch (e) {
    // Idempotent: the UNIQUE (memo, user, emoji) constraint trips when the
    // viewer has already reacted with this emoji.
    if (!/UNIQUE constraint failed/i.test(String((e as Error).message ?? e))) {
      throw e;
    }
  }
  const tally = await tallyReactions(c.env, memoId, viewerId);
  return c.json({ tally });
});

/** DELETE /memos/:memoId/reactions?emoji=👍 — removes the viewer's reaction. */
interactionRoutes.delete("/memos/:memoId/reactions", requireAuth(), async (c) => {
  const viewerId = c.get("userId") as string;
  const memoId = c.req.param("memoId");
  const emoji = c.req.query("emoji") ?? "";
  if (!isAllowedEmoji(emoji)) {
    throw new ValidationError("Invalid emoji");
  }
  if (!c.env?.DB) throw new NotFoundError("Database");
  const meta = await loadMemoMeta(c.env, memoId);
  if (!meta) throw new NotFoundError("Memo");
  assertInteractable(meta, viewerId);

  await c.env.DB.prepare(
    `DELETE FROM memo_reactions WHERE memo_id = ? AND user_id = ? AND emoji = ?`,
  )
    .bind(memoId, viewerId, emoji)
    .run();
  const tally = await tallyReactions(c.env, memoId, viewerId);
  return c.json({ tally });
});

/** GET /memos/:memoId/reactions — tally + viewer's selections. */
interactionRoutes.get("/memos/:memoId/reactions", requireAuth(), async (c) => {
  const viewerId = c.get("userId") as string;
  const memoId = c.req.param("memoId");
  if (!c.env?.DB) return c.json({ tally: [] });
  const meta = await loadMemoMeta(c.env, memoId);
  if (!meta) throw new NotFoundError("Memo");
  assertInteractable(meta, viewerId);
  const tally = await tallyReactions(c.env, memoId, viewerId);
  return c.json({ tally });
});

async function tallyReactions(
  env: Env,
  memoId: string,
  viewerId: string,
): Promise<ReactionTally[]> {
  if (!env?.DB) return [];
  const { results } = await env.DB.prepare(
    `SELECT emoji, COUNT(*) AS cnt,
            SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS viewer_count
       FROM memo_reactions
      WHERE memo_id = ?
      GROUP BY emoji
      ORDER BY cnt DESC, emoji ASC`,
  )
    .bind(viewerId, memoId)
    .all<{ emoji: string; cnt: number; viewer_count: number }>();
  return (results ?? []).map((r) => ({
    emoji: r.emoji,
    count: Number(r.cnt) || 0,
    reactedByViewer: Number(r.viewer_count) > 0,
  }));
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/** POST /memos/:memoId/comments { body } — creates a new short comment. */
interactionRoutes.post("/memos/:memoId/comments", requireAuth(), async (c) => {
  const viewerId = c.get("userId") as string;
  const memoId = c.req.param("memoId");
  const raw = await c.req.json().catch(() => ({}));
  const body = sanitizeComment((raw as { body?: unknown }).body);
  if (!body) {
    throw new ValidationError(
      `Comment must be 1–${COMMENT_MAX} characters, no newlines`,
    );
  }
  if (!c.env?.DB) throw new NotFoundError("Database");
  const meta = await loadMemoMeta(c.env, memoId);
  if (!meta) throw new NotFoundError("Memo");
  assertInteractable(meta, viewerId);

  const id = newId("cmt");
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO memo_comments (id, memo_id, user_id, body, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, memoId, viewerId, body, now)
    .run();
  return c.json({
    comment: {
      id,
      memoId,
      userId: viewerId,
      body,
      createdAt: now,
    } satisfies MemoComment,
  });
});

/** GET /memos/:memoId/comments?cursor=... — paginated newest-first list. */
interactionRoutes.get("/memos/:memoId/comments", requireAuth(), async (c) => {
  const viewerId = c.get("userId") as string;
  const memoId = c.req.param("memoId");
  const cursor = c.req.query("cursor") ?? undefined;
  const limit = Math.max(1, Math.min(Number(c.req.query("limit") ?? 30) || 30, 100));
  if (!c.env?.DB) return c.json({ items: [], nextCursor: null });
  const meta = await loadMemoMeta(c.env, memoId);
  if (!meta) throw new NotFoundError("Memo");
  assertInteractable(meta, viewerId);

  const binds: unknown[] = [memoId];
  let where = "memo_id = ?";
  if (cursor) {
    where += " AND created_at < ?";
    binds.push(cursor);
  }
  binds.push(limit + 1);
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.memo_id, c.user_id, c.body, c.created_at,
            u.display_name AS author_name,
            u.avatar_updated_at AS author_avatar
       FROM memo_comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE ${where}
       ORDER BY c.created_at DESC
       LIMIT ?`,
  )
    .bind(...binds)
    .all<{
      id: string;
      memo_id: string;
      user_id: string;
      body: string;
      created_at: string;
      author_name: string | null;
      author_avatar: string | null;
    }>();
  const rows = results ?? [];
  const items = rows.slice(0, limit).map((r) => ({
    id: r.id,
    memoId: r.memo_id,
    userId: r.user_id,
    body: r.body,
    createdAt: r.created_at,
    author: {
      displayName: r.author_name ?? "?",
      avatarUrl: r.author_avatar
        ? `/users/${r.user_id}/avatar?v=${encodeURIComponent(r.author_avatar)}`
        : null,
    },
  }));
  const nextCursor =
    rows.length > limit ? items[items.length - 1].createdAt : null;
  return c.json({ items, nextCursor });
});

/** DELETE /memos/:memoId/comments/:commentId — author or memo owner only. */
interactionRoutes.delete(
  "/memos/:memoId/comments/:commentId",
  requireAuth(),
  async (c) => {
    const viewerId = c.get("userId") as string;
    const memoId = c.req.param("memoId");
    const commentId = c.req.param("commentId");
    if (!c.env?.DB) throw new NotFoundError("Database");
    const meta = await loadMemoMeta(c.env, memoId);
    if (!meta) throw new NotFoundError("Memo");
    const row = await c.env.DB.prepare(
      `SELECT user_id FROM memo_comments WHERE id = ? AND memo_id = ?`,
    )
      .bind(commentId, memoId)
      .first<{ user_id: string }>();
    if (!row) throw new NotFoundError("Comment");
    const isAuthor = row.user_id === viewerId;
    const isMemoOwner = meta.ownerId === viewerId;
    if (!isAuthor && !isMemoOwner) {
      throw new ForbiddenError("Cannot delete this comment");
    }
    await c.env.DB.prepare(`DELETE FROM memo_comments WHERE id = ?`)
      .bind(commentId)
      .run();
    return c.json({ ok: true });
  },
);
