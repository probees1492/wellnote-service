import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Logo mark — square "W'" icon, brush-painted (matches /public/logo-mark.svg
 * and the launcher icon). 4 stroked segments thin from left to right so the
 * glyph reads as one continuous brush motion. Background uses currentColor
 * so the surrounding text color drives the chip color (light-mode = dark,
 * dark-mode = light) and the strokes invert against it.
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
      >
        <path d="M 208 296 L 380 800" strokeWidth={88} />
        <path d="M 380 800 L 512 512" strokeWidth={80} />
        <path d="M 512 512 L 644 800" strokeWidth={72} />
        <path d="M 644 800 L 816 296" strokeWidth={64} />
      </g>
      <path
        d="M 866 222 L 836 364"
        fill="none"
        stroke="var(--background, #fff)"
        strokeWidth={42}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Wordmark — "We'llNote" rendered as inline SVG.
 *
 * The apostrophe (will의 약자) is a 3 px vertical bar squeezed between 'e'
 * and 'l' so the brand reads as "WellNote" at a glance and "We'll Note"
 * on closer inspection. fill="currentColor" picks up the surrounding
 * text color (works in dark mode).
 *
 * Size prop controls the SVG height; width auto-scales via the viewBox.
 */
export function LogoWordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes: Record<typeof size, string> = {
    sm: "h-5",
    md: "h-6",
    lg: "h-8",
    xl: "h-12 lg:h-16",
  } as const;
  return (
    <svg
      viewBox="0 0 410 120"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="We'llNote"
      className={cn("w-auto text-foreground", sizes[size], className)}
    >
      <g
        fontFamily='"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        fontWeight={800}
        fontSize={100}
        letterSpacing={-3}
        fill="currentColor"
      >
        <text x={0} y={92}>We</text>
        <rect x={139} y={22} width={3} height={20} rx={1.5} />
        <text x={145} y={92}>llNote</text>
      </g>
    </svg>
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
