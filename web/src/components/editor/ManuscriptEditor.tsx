"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import {
  type EditorPrefs,
  loadEditorPrefs,
  subscribeEditorPrefs,
} from "@/lib/editor-prefs";
import { playPenTick } from "@/lib/pen-sound";

import { InkCursorEffect } from "./InkCursorEffect";
import { SealCountdown, msUntilKstMidnight } from "./SealCountdown";
import { SealingStamp } from "./SealingStamp";

export interface ManuscriptEditorHandle {
  textarea: HTMLTextAreaElement | null;
  focus: () => void;
}

interface ManuscriptEditorProps {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** When sealing animation completes, parent should reload to readonly. */
  onSealed?: () => void;
  className?: string;
  /** Forwarded data-testid for E2E parity with the previous textarea. */
  "data-testid"?: string;
  /** Forwarded data-ready (memo loaded?). */
  "data-ready"?: string;
}

/**
 * Distinctive WellNote editor: traditional Korean manuscript paper (200자
 * 원고지) underlay, KST-midnight seal countdown, typewriter focus, ink
 * cursor, paper shadow, sealing stamp, optional pen-scratch audio, and
 * first-line indent. All effects are pref-gated via `editor-prefs`.
 */
export const ManuscriptEditor = forwardRef<
  ManuscriptEditorHandle,
  ManuscriptEditorProps
>(function ManuscriptEditor(
  {
    value,
    onChange,
    onBlur,
    disabled,
    placeholder,
    onSealed,
    className,
    "data-testid": dataTestId = "memo-editor",
    "data-ready": dataReady,
  },
  ref,
) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [prefs, setPrefs] = useState<EditorPrefs>(() => loadEditorPrefs());
  const [msRemaining, setMsRemaining] = useState<number>(() =>
    msUntilKstMidnight(),
  );

  useImperativeHandle(
    ref,
    () => ({
      get textarea() {
        return taRef.current;
      },
      focus() {
        taRef.current?.focus();
      },
    }),
    [],
  );

  // Re-load prefs whenever they change (same tab or other tab).
  useEffect(() => {
    const unsub = subscribeEditorPrefs(() => setPrefs(loadEditorPrefs()));
    return unsub;
  }, []);

  // Auto-grow the textarea to fit content (no inner scroll — page scrolls).
  const autosize = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.max(ta.scrollHeight, 420);
    ta.style.height = `${next}px`;
  }, []);

  useEffect(() => {
    autosize();
  }, [value, autosize]);

  // Typewriter focus: scroll the caret line into the viewport's vertical
  // centre. Needs a bottom spacer (rendered below) so the document can
  // scroll past the editor's end — otherwise the last lines pin to the
  // bottom of the viewport instead of centering. We also clamp via
  // window.scrollTo's intrinsic min 0 so the first lines do NOT scroll
  // (they just sit near the top until enough content has been written for
  // the caret to drift below mid-viewport).
  useEffect(() => {
    if (!prefs.typewriter) return;
    const ta = taRef.current;
    if (!ta) return;

    let raf: number | null = null;
    const scheduleScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const cs = window.getComputedStyle(ta);
        const lh = parseFloat(cs.lineHeight) || 32;
        // Caret column count won't matter — line count up to caret does.
        const caretIdx = ta.selectionEnd ?? ta.value.length;
        const beforeCaret = ta.value.slice(0, caretIdx);
        const linesBefore = beforeCaret.split("\n").length - 1;
        const taRect = ta.getBoundingClientRect();
        // taRect.top is viewport-relative; convert to document-relative.
        const caretY =
          taRect.top + window.scrollY + linesBefore * lh + lh / 2;
        const targetScroll = Math.max(
          0,
          caretY - window.innerHeight / 2,
        );
        // 'instant' for keyup so the caret doesn't visibly lag behind the
        // smooth scroll while typing fast. Smooth still feels good on
        // click/focus, but the keyup path dominates.
        window.scrollTo({ top: targetScroll, behavior: "instant" });
      });
    };
    const onAny = () => scheduleScroll();
    ta.addEventListener("input", onAny);
    ta.addEventListener("keyup", onAny);
    ta.addEventListener("click", onAny);
    ta.addEventListener("focus", onAny);
    return () => {
      ta.removeEventListener("input", onAny);
      ta.removeEventListener("keyup", onAny);
      ta.removeEventListener("click", onAny);
      ta.removeEventListener("focus", onAny);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [prefs.typewriter]);

  const handleKeyPress = useCallback(() => {
    if (prefs.penSound) playPenTick();
  }, [prefs.penSound]);

  // Background pattern selection.
  const gridBgClass = useMemo(() => {
    switch (prefs.gridStyle) {
      case "lines":
        return "wn-paper-lines";
      case "dots":
        return "wn-paper-dots";
      case "manuscript":
      default:
        return "wn-paper-manuscript";
    }
  }, [prefs.gridStyle]);

  // Tighter warmth glow on the top-right as midnight nears.
  const warmth = useMemo(() => {
    const totalSec = Math.max(0, Math.floor(msRemaining / 1000));
    return Math.max(
      0,
      Math.min(1, 1 - (totalSec - 30 * 60) / (6 * 60 * 60 - 30 * 60)),
    );
  }, [msRemaining]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "wn-paper relative isolate overflow-hidden rounded-2xl",
        gridBgClass,
        className,
      )}
      data-grid-style={prefs.gridStyle}
      data-typewriter={prefs.typewriter ? "on" : "off"}
      data-first-line-indent={prefs.firstLineIndent ? "on" : "off"}
      data-ink-cursor={prefs.inkCursor ? "on" : "off"}
      data-pen-sound={prefs.penSound ? "on" : "off"}
    >
      {/* Warmth glow — only when countdown is enabled */}
      {prefs.sealCountdown ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 z-0 h-48 w-48 rounded-full blur-3xl transition-opacity duration-700"
          style={{
            background:
              "radial-gradient(closest-side, rgba(251,191,36,0.35), rgba(251,191,36,0))",
            opacity: 0.15 + warmth * 0.55,
          }}
        />
      ) : null}

      {/* Countdown copy, top-right corner */}
      <div className="relative z-10 flex items-center justify-end px-5 pt-3">
        <SealCountdown
          visible={prefs.sealCountdown}
          onTick={setMsRemaining}
        />
      </div>

      {/* The actual paper surface */}
      <div className="relative z-10 px-2 pb-6 pt-2 sm:px-6">
        <div className="relative">
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              autosize();
            }}
            onBlur={onBlur}
            onInput={autosize}
            disabled={disabled}
            placeholder={placeholder}
            className={cn(
              "wn-paper-textarea relative z-10 block w-full resize-none border-0 bg-transparent",
              "p-4 sm:p-6 font-serif text-base leading-[2rem]",
              "tracking-[0.02em] outline-none focus:outline-none focus-visible:outline-none",
              "placeholder:text-muted-foreground/60",
              prefs.firstLineIndent && "wn-first-line-indent",
              prefs.typewriter && "wn-typewriter-mask",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
            style={{
              caretColor: "hsl(var(--primary))",
              minHeight: 420,
              // letter-spacing nudged so 명조체 글자가 32px 칸 폭에 자연스럽게 맞춤
              lineHeight: "2rem",
            }}
            data-testid={dataTestId}
            data-ready={dataReady}
            spellCheck={false}
          />

          {/* Ink cursor bleed dots — sits above the textarea visually but
              is pointer-events:none so typing is unaffected. */}
          <InkCursorEffect
            targetRef={taRef}
            enabled={prefs.inkCursor && !disabled}
            onKeyPress={handleKeyPress}
          />
        </div>
      </div>

      {/* Final-30s countdown + stamp — opt-in */}
      {prefs.sealStamp ? (
        <SealingStamp msRemaining={msRemaining} onSealed={onSealed} />
      ) : null}

      {/* Bottom spacer for typewriter mode — gives the document room to
          scroll so the LAST line can sit at the viewport centre. Sized at
          50vh so any caret position within the last screenful is
          centerable. */}
      {prefs.typewriter ? (
        <div aria-hidden className="h-[50vh] w-full" />
      ) : null}
    </div>
  );
});
