"use client";

import Link from "next/link";

import { type FeedItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatRelativeKorean } from "@/lib/time";

import { BuddyAvatar } from "./BuddyAvatar";

const PIN_HEAD_BY_COLOR: Record<string, string> = {
  slate: "bg-slate-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
};

function pinHeadClass(color: string): string {
  return PIN_HEAD_BY_COLOR[color] ?? "bg-slate-500";
}

interface FeedCardProps {
  item: FeedItem;
}

/** Single row in the buddy feed list — links to the readonly memo viewer. */
export function FeedCard({ item }: FeedCardProps) {
  const title = (item.title ?? "").trim() || "(제목 없음)";
  return (
    <Link
      href={`/app/memo?id=${encodeURIComponent(item.memoId)}`}
      className="block focus:outline-none"
      data-testid={`feed-card-${item.memoId}`}
    >
      <article className="flex flex-col gap-2 rounded-md border bg-card p-4 transition hover:shadow-sm">
        <div className="flex items-center gap-2">
          <BuddyAvatar
            displayName={item.ownerDisplayName}
            avatarUrl={item.ownerAvatarUrl}
            sizeClass="h-8 w-8"
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground">
              {item.ownerDisplayName}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeKorean(item.updatedAt)} · {item.dateKst}
            </span>
          </div>
        </div>
        <h3 className="line-clamp-2 font-serif text-base font-semibold leading-snug text-foreground/90">
          {title}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5">
            <span
              className={cn("h-2 w-2 rounded-full", pinHeadClass(item.pinColor))}
              aria-hidden
            />
            {item.pinName}
          </span>
          <span>{item.charCount.toLocaleString()}자</span>
        </div>
      </article>
    </Link>
  );
}
