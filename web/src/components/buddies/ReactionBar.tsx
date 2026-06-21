"use client";

import { Plus } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";

import { api, type ReactionTally } from "@/lib/api";
import { cn } from "@/lib/utils";

// Fixed palette of allowed emoji (must match `backend/src/domain/memo-interaction.ts`).
const REACTION_PALETTE = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "✨"] as const;

interface ReactionBarProps {
  memoId: string;
  /** Initial tally. Component still re-fetches once on mount to be safe. */
  initial?: ReactionTally[];
}

/**
 * Horizontal pill list of emoji tallies + a "+" trigger that opens a small
 * palette popover. Toggles are optimistic with revert-on-error.
 */
export function ReactionBar({ memoId, initial = [] }: ReactionBarProps) {
  const [tally, setTally] = useState<ReactionTally[]>(initial);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Hydrate from the server once, so we get accurate `reactedByViewer` flags.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.reactions.list(memoId);
        if (!alive) return;
        setTally(r.tally);
      } catch {
        /* leave initial in place */
      }
    })();
    return () => {
      alive = false;
    };
  }, [memoId]);

  // Close popover on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function applyOptimistic(emoji: string, nextReacted: boolean): ReactionTally[] {
    const existing = tally.find((t) => t.emoji === emoji);
    if (existing) {
      const delta = nextReacted ? 1 : -1;
      const nextCount = Math.max(0, existing.count + delta);
      const next = tally
        .map((t) =>
          t.emoji === emoji
            ? { ...t, count: nextCount, reactedByViewer: nextReacted }
            : t,
        )
        .filter((t) => t.count > 0);
      return next;
    }
    if (nextReacted) {
      return [...tally, { emoji, count: 1, reactedByViewer: true }];
    }
    return tally;
  }

  async function toggle(emoji: string) {
    const current = tally.find((t) => t.emoji === emoji);
    const wasReacted = !!current?.reactedByViewer;
    const next = applyOptimistic(emoji, !wasReacted);
    const snapshot = tally;
    setTally(next);
    setErr(null);
    try {
      const r = wasReacted
        ? await api.reactions.remove(memoId, emoji)
        : await api.reactions.add(memoId, emoji);
      setTally(r.tally);
    } catch (e: unknown) {
      setTally(snapshot);
      const msg = e instanceof Error ? e.message : "리액션을 갱신하지 못했어요.";
      setErr(msg);
    }
  }

  return (
    <div className="flex flex-col gap-1" data-testid="reaction-bar">
      <div ref={containerRef} className="relative flex flex-wrap items-center gap-2">
        {tally.map((t) => (
          <button
            key={t.emoji}
            type="button"
            onClick={() => void toggle(t.emoji)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-colors",
              t.reactedByViewer
                ? "border-primary bg-primary/10 text-foreground"
                : "border-input bg-background hover:bg-accent",
            )}
            data-testid={`reaction-pill-${t.emoji}`}
            aria-pressed={t.reactedByViewer}
          >
            <span aria-hidden>{t.emoji}</span>
            <span className="text-xs tabular-nums">{t.count}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-input bg-background text-muted-foreground transition-colors hover:bg-accent"
          aria-label="리액션 추가"
          data-testid="reaction-add-trigger"
        >
          <Plus className="h-4 w-4" weight="bold" aria-hidden />
        </button>
        {open ? (
          <div
            role="menu"
            aria-label="리액션 선택"
            className="absolute left-0 top-full z-20 mt-2 flex items-center gap-1 rounded-md border bg-popover p-2 shadow-md"
            data-testid="reaction-palette"
          >
            {REACTION_PALETTE.map((emoji) => {
              const active = tally.some(
                (t) => t.emoji === emoji && t.reactedByViewer,
              );
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void toggle(emoji);
                  }}
                  className={cn(
                    "rounded-md px-2 py-1 text-lg transition-colors hover:bg-accent",
                    active && "bg-primary/10",
                  )}
                  data-testid={`reaction-palette-${emoji}`}
                  aria-label={`${emoji} 리액션`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {err ? (
        <span className="text-xs text-destructive" data-testid="reaction-error">
          {err}
        </span>
      ) : null}
    </div>
  );
}
