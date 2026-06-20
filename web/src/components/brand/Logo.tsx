import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Logo mark — square "W'" icon. Adapts to currentColor.
 */
export function LogoMark({
  className,
  ...props
}: React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="We'llNote"
      className={cn("h-6 w-6 rounded-md text-foreground", className)}
      {...props}
    >
      <rect width="1024" height="1024" rx="224" fill="currentColor" />
      <g
        fill="none"
        stroke="var(--background, #fff)"
        strokeLinecap="round"
        strokeLinejoin="round"
        // 시스템 색 대비를 위해 inverse fill 강제.
      >
        <path
          d="M 200 310 L 372 790 L 512 470 L 652 790 L 824 310"
          strokeWidth={92}
        />
        <path d="M 882 220 L 842 410" strokeWidth={64} />
      </g>
    </svg>
  );
}

/**
 * Wordmark — "We'llNote" using current font (Pretendard). Apostrophe is
 * visually emphasized so the brand reads as "We will note!".
 */
export function LogoWordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes: Record<typeof size, string> = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-4xl lg:text-5xl",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-extrabold tracking-tight text-foreground",
        sizes[size],
        className,
      )}
      aria-label="We'llNote"
    >
      We<span className="opacity-70">&apos;</span>llNote
    </span>
  );
}

/**
 * Mark + wordmark side by side, for header/sidebar.
 */
export function LogoLockup({
  className,
  wordmarkSize = "md",
  showMark = false,
  showWordmark = true,
}: {
  className?: string;
  wordmarkSize?: "sm" | "md" | "lg" | "xl";
  showMark?: boolean;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {showMark ? <LogoMark className="h-6 w-6" /> : null}
      {showWordmark ? <LogoWordmark size={wordmarkSize} /> : null}
    </span>
  );
}
