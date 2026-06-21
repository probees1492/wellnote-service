"use client";

import { UserCircle } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { resolveAvatarUrl } from "@/lib/api";

interface BuddyAvatarProps {
  displayName: string;
  avatarUrl: string | null;
  /** Tailwind size class, e.g. "h-10 w-10". Defaults to "h-10 w-10". */
  sizeClass?: string;
  className?: string;
}

/**
 * Compact round avatar — image when available, initial fallback otherwise.
 * Mirrors the avatar style used by `AvatarPicker` but at a smaller size.
 */
export function BuddyAvatar({
  displayName,
  avatarUrl,
  sizeClass = "h-10 w-10",
  className,
}: BuddyAvatarProps) {
  const src = resolveAvatarUrl(avatarUrl);
  const initial = (displayName || "?").trim().slice(0, 1).toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted/40",
        sizeClass,
        className,
      )}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : initial ? (
        <span className="font-serif text-sm text-muted-foreground">
          {initial}
        </span>
      ) : (
        <UserCircle weight="duotone" className="h-2/3 w-2/3 text-muted-foreground" />
      )}
    </span>
  );
}
