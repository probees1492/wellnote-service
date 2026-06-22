"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { PrintOptions } from "@/lib/print-options";
import { cn } from "@/lib/utils";

interface PrintableMemoProps {
  dateKst: string;
  body: string;
  displayName?: string | null;
  readonlyAt?: string | null;
  options: PrintOptions;
  /** When true, applies preview-sized styling for the dialog mock-up. */
  preview?: boolean;
}

/**
 * The document we send to the printer. Lives both inside the
 * PrintPreviewDialog (for the on-screen mock-up) and — via a body portal —
 * as the actual print target. Layout matches what comes out of `window.print()`
 * 1:1; toggles in the dialog directly drive what's rendered here.
 */
export function PrintableMemo({
  dateKst,
  body,
  displayName,
  readonlyAt,
  options,
  preview = false,
}: PrintableMemoProps) {
  const sealLabel =
    readonlyAt && options.sealTime
      ? new Date(readonlyAt).toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <article
      className={cn(
        "wn-printable mx-auto bg-white text-[#1f1a12]",
        // The two paper modes — preview shrinks to dialog width; print
        // takes the @page box. Padding/margin tuned so the printer's
        // physical margin (set in @page CSS) doesn't compound.
        preview
          ? "w-full max-w-[480px] rounded-md border p-6 shadow-sm"
          : "w-full p-0",
        options.grid && "wn-printable-grid",
      )}
      data-printable
    >
      {options.header ? (
        <header className="mb-4 flex items-baseline justify-between border-b border-[#1f1a12]/20 pb-2 text-sm">
          <span className="font-medium">{dateKst}</span>
          {displayName ? (
            <span className="font-serif italic text-[#1f1a12]/70">
              {displayName}
            </span>
          ) : null}
        </header>
      ) : null}

      <div
        className={cn(
          "markdown-body font-serif leading-[2rem] tracking-[0.02em]",
          preview ? "text-sm" : "text-base",
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>

      {sealLabel ? (
        <p className="mt-6 text-right text-xs text-[#1f1a12]/60">
          봉인 {sealLabel}
        </p>
      ) : null}

      {options.watermark || options.pageNumber ? (
        <footer className="mt-8 flex items-center justify-between border-t border-[#1f1a12]/15 pt-2 text-xs text-[#1f1a12]/55">
          <span>{options.watermark ? "wellnote.io" : ""}</span>
          {options.pageNumber ? (
            // CSS counter for page numbers — only renders meaningful values
            // when actually printed (preview shows "p.").
            <span className="wn-page-number">p.</span>
          ) : (
            <span />
          )}
        </footer>
      ) : null}
    </article>
  );
}
