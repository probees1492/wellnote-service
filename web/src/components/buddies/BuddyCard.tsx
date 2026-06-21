"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { api, type BuddyProfile } from "@/lib/api";
import { cn } from "@/lib/utils";

import { BuddyAvatar } from "./BuddyAvatar";

interface BuddyCardProps {
  buddy: BuddyProfile;
  /** Called when the underlying follow state changes (optimistic). */
  onChange?: (next: BuddyProfile) => void;
  /** When true, the card body acts as a link to the buddy profile detail. */
  linkToProfile?: boolean;
  className?: string;
}

/**
 * Single-row card: avatar + displayName + follower count + follow toggle.
 * Follow/unfollow is optimistic; we revert on error and surface an inline
 * message via a small text span.
 */
export function BuddyCard({
  buddy,
  onChange,
  linkToProfile = true,
  className,
}: BuddyCardProps) {
  const [state, setState] = useState<BuddyProfile>(buddy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync local state when the parent feeds a different profile reference
  // (e.g. switching between search results, or a parent-driven refresh).
  useEffect(() => {
    setState(buddy);
  }, [buddy]);

  async function toggleFollow(e: React.MouseEvent) {
    // The card body may be wrapped in a <Link>; stop the click so we don't
    // navigate when only the button was pressed.
    e.preventDefault();
    e.stopPropagation();
    if (state.isSelf || busy) return;
    setBusy(true);
    setError(null);
    const wasFollowing = state.isFollowing;
    const optimistic: BuddyProfile = {
      ...state,
      isFollowing: !wasFollowing,
      followerCount: Math.max(0, state.followerCount + (wasFollowing ? -1 : 1)),
    };
    setState(optimistic);
    onChange?.(optimistic);
    try {
      const r = wasFollowing
        ? await api.buddies.unfollow(state.id)
        : await api.buddies.follow(state.id);
      setState(r.buddy);
      onChange?.(r.buddy);
    } catch (err: unknown) {
      // Revert on failure.
      setState(state);
      onChange?.(state);
      const msg = err instanceof Error ? err.message : "요청에 실패했어요.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border bg-card p-3 transition hover:shadow-sm",
        className,
      )}
      data-testid={`buddy-card-${state.id}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <BuddyAvatar
          displayName={state.displayName}
          avatarUrl={state.avatarUrl}
        />
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span
              className="truncate font-medium text-foreground"
              data-testid="buddy-name"
            >
              {state.displayName}
            </span>
            {state.isSelf ? (
              <span className="text-xs text-muted-foreground">(나)</span>
            ) : state.isFollower ? (
              <span className="rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                나를 팔로우
              </span>
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground">
            팔로워 {state.followerCount.toLocaleString()}
          </span>
          {error ? (
            <span className="text-xs text-destructive">{error}</span>
          ) : null}
        </div>
      </div>

      {state.isSelf ? null : (
        <Button
          type="button"
          size="sm"
          variant={state.isFollowing ? "outline" : "default"}
          onClick={toggleFollow}
          disabled={busy}
          data-testid={`buddy-follow-${state.id}`}
        >
          {state.isFollowing ? "팔로잉" : "팔로우"}
        </Button>
      )}
    </div>
  );

  if (linkToProfile) {
    return (
      <Link
        href={`/app/buddies?id=${encodeURIComponent(state.id)}`}
        className="block focus:outline-none"
        data-testid={`buddy-card-link-${state.id}`}
      >
        {content}
      </Link>
    );
  }
  return content;
}
