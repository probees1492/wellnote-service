"use client";

import { Trash } from "@phosphor-icons/react/dist/ssr";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type BuddyComment } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { formatRelativeKorean } from "@/lib/time";

import { BuddyAvatar } from "./BuddyAvatar";

const MAX_LEN = 20;

interface CommentSectionProps {
  memoId: string;
  /** Memo owner id. The owner can delete any comment on their memo. */
  ownerId: string;
}

/** List + composer for memo comments. Newest-first. Pagination by cursor. */
export function CommentSection({ memoId, ownerId }: CommentSectionProps) {
  const me = useAuth((s) => s.user);
  const [items, setItems] = useState<BuddyComment[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.comments.list(memoId);
      setItems(r.items);
      setCursor(r.nextCursor);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "댓글을 불러오지 못했어요.";
      setErr(msg);
      setItems([]);
    }
  }, [memoId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await api.comments.list(memoId, cursor);
      setItems((prev) => (prev ? [...prev, ...r.items] : r.items));
      setCursor(r.nextCursor);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "더 불러오지 못했어요.";
      setErr(msg);
    } finally {
      setLoadingMore(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || busy) return;
    if (trimmed.length > MAX_LEN) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.comments.create(memoId, trimmed);
      setItems((prev) => (prev ? [r.comment, ...prev] : [r.comment]));
      setDraft("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "등록에 실패했어요.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  async function remove(comment: BuddyComment) {
    const snapshot = items;
    setItems((prev) => prev?.filter((c) => c.id !== comment.id) ?? prev);
    try {
      await api.comments.delete(memoId, comment.id);
    } catch (e: unknown) {
      setItems(snapshot ?? null);
      const msg = e instanceof Error ? e.message : "삭제에 실패했어요.";
      setErr(msg);
    }
  }

  const count = draft.trim().length;
  const overLimit = count > MAX_LEN;

  return (
    <div className="flex flex-col gap-3" data-testid="comment-section">
      <form onSubmit={submit} className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="짧게 한 마디 (최대 20자)"
            maxLength={MAX_LEN}
            data-testid="comment-input"
            disabled={busy}
          />
          <Button
            type="submit"
            disabled={busy || count === 0 || overLimit}
            data-testid="comment-submit"
          >
            등록
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>줄바꿈 없이 한 줄로 작성해 주세요.</span>
          <span
            className={overLimit ? "text-destructive" : undefined}
            data-testid="comment-counter"
          >
            {count}/{MAX_LEN}
          </span>
        </div>
      </form>

      {err ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
          data-testid="comment-error"
        >
          {err}
        </div>
      ) : null}

      {items === null ? (
        <div className="text-sm text-muted-foreground">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground" data-testid="comment-empty">
          아직 댓글이 없어요.
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="comment-list">
          {items.map((c) => {
            const canDelete =
              !!me && (me.id === c.userId || me.id === ownerId);
            return (
              <li
                key={c.id}
                className="flex items-start gap-2 rounded-md border bg-card p-2.5"
                data-testid={`comment-${c.id}`}
              >
                <BuddyAvatar
                  displayName={c.author.displayName}
                  avatarUrl={c.author.avatarUrl}
                  sizeClass="h-7 w-7"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium">
                      {c.author.displayName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeKorean(c.createdAt)}
                    </span>
                  </div>
                  <span className="break-words text-sm text-foreground/90">
                    {c.body}
                  </span>
                </div>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => void remove(c)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                    aria-label="댓글 삭제"
                    data-testid={`comment-delete-${c.id}`}
                  >
                    <Trash className="h-4 w-4" weight="duotone" aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {cursor ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          data-testid="comment-load-more"
        >
          {loadingMore ? "불러오는 중..." : "더 보기"}
        </Button>
      ) : null}
    </div>
  );
}
