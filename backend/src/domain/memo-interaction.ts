/**
 * Buddy interactions on a memo: emoji reactions + short (≤20 char) comments.
 *
 * Reactions follow Slack's "I reacted with this emoji" model — one row per
 * (memo, user, emoji). Comments are flat (no thread), capped at 20 chars.
 */

export const COMMENT_MAX = 20;

export interface MemoReaction {
  id: string;
  memoId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface MemoComment {
  id: string;
  memoId: string;
  userId: string;
  body: string;
  createdAt: string;
}

/**
 * Aggregate counts surfaced on the feed: one entry per distinct emoji and
 * whether the viewer has reacted with it themselves.
 */
export interface ReactionTally {
  emoji: string;
  count: number;
  reactedByViewer: boolean;
}

// Whitelist of emoji characters allowed in reactions. We accept any single
// grapheme that begins with an emoji codepoint to keep the rule loose but
// non-malicious. Compound flags / ZWJ sequences pass when their first cluster
// is itself an emoji. Rejecting ascii-only inputs prevents abuse via comment
// text in the reaction field.
const EMOJI_REGEX = /^[\p{Extended_Pictographic}\u2600-\u27BF][\p{Extended_Pictographic}\u200D\uFE0F\u2600-\u27BF]{0,5}$/u;

export function isAllowedEmoji(value: unknown): value is string {
  return typeof value === "string" && EMOJI_REGEX.test(value);
}

export function sanitizeComment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > COMMENT_MAX) return null;
  // Reject newlines / control chars — comments are one-liners.
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null;
  return trimmed;
}
