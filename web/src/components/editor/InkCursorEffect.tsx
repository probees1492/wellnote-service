"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface InkDot {
  id: number;
  x: number;
  y: number;
  size: number;
  bornAt: number;
}

interface InkCursorEffectProps {
  /** Ref to the textarea whose keystrokes we should track. */
  targetRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Toggle from editor prefs. */
  enabled: boolean;
  /** When true, also dispatch pen-tick sounds (handled by parent via key handler). */
  onKeyPress?: () => void;
}

/**
 * Renders short-lived ink "bleed" dots at the caret position whenever the
 * user types a printable character. Pure CSS, GPU-friendly: each dot is a
 * positioned span with `transform`/`opacity` transitions over ~250ms before
 * being garbage-collected.
 *
 * Positioning trick: we use a hidden mirror <div> that mimics the textarea
 * box (same font / padding / wrapping) and contains the text up to the
 * caret, plus a marker <span>. The marker's bounding rect tells us where
 * to drop the dot — accurate even with line wrapping and IME composition.
 */
export function InkCursorEffect({
  targetRef,
  enabled,
  onKeyPress,
}: InkCursorEffectProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(0);
  const [dots, setDots] = useState<InkDot[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const ta = targetRef.current;
    if (!ta) return;

    function syncMirror(textArea: HTMLTextAreaElement) {
      const mirror = mirrorRef.current;
      if (!mirror) return;
      const cs = window.getComputedStyle(textArea);
      // Copy the styles that affect text layout.
      const styles: (keyof CSSStyleDeclaration)[] = [
        "fontFamily",
        "fontSize",
        "fontWeight",
        "fontStyle",
        "lineHeight",
        "letterSpacing",
        "padding",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "boxSizing",
        "textIndent",
        "whiteSpace",
        "wordBreak",
        "wordWrap",
        "tabSize",
      ];
      for (const k of styles) {
        const val = cs[k];
        if (typeof val === "string") {
          (mirror.style as unknown as Record<string, string>)[k as string] =
            val;
        }
      }
      mirror.style.width = `${textArea.clientWidth}px`;
      mirror.style.height = "auto";
      mirror.style.whiteSpace = "pre-wrap";
      mirror.style.wordBreak = "break-word";
    }

    function spawnDot() {
      const textArea = targetRef.current;
      const mirror = mirrorRef.current;
      const wrap = wrapRef.current;
      if (!textArea || !mirror || !wrap) return;

      syncMirror(textArea);

      // Align the mirror exactly over the textarea so marker coords are
      // the caret's screen-space position.
      const taRect = textArea.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      mirror.style.left = `${taRect.left - wrapRect.left}px`;
      mirror.style.top = `${taRect.top - wrapRect.top - textArea.scrollTop}px`;

      const value = textArea.value.slice(0, textArea.selectionEnd ?? 0);
      mirror.textContent = value;
      const marker = document.createElement("span");
      marker.textContent = "\u200b"; // ZWSP, zero-width but line-height-bearing
      mirror.appendChild(marker);

      const markerRect = marker.getBoundingClientRect();
      const finalX = markerRect.left - wrapRect.left + 1;
      const finalY = markerRect.top - wrapRect.top + 4;

      mirror.removeChild(marker);

      const id = (idRef.current += 1);
      const size = 4 + Math.random() * 2;
      setDots((prev) => [
        ...prev.slice(-8),
        { id, x: finalX, y: finalY, size, bornAt: performance.now() },
      ]);
      // Auto-remove after the animation completes.
      window.setTimeout(() => {
        setDots((prev) => prev.filter((d) => d.id !== id));
      }, 280);
    }

    function shouldSpawn(e: KeyboardEvent): boolean {
      if (e.metaKey || e.ctrlKey || e.altKey) return false;
      if (e.isComposing) return false;
      const k = e.key;
      // Only printable keys + space + enter trigger a bleed dot.
      if (k.length === 1) return true;
      if (k === "Enter" || k === "Spacebar" || k === " ") return true;
      return false;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!shouldSpawn(e)) return;
      onKeyPress?.();
      // Wait one frame so the value/selection reflect the new key.
      requestAnimationFrame(() => spawnDot());
    }

    ta.addEventListener("keydown", onKeyDown);
    return () => {
      ta.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, onKeyPress, targetRef]);

  if (!enabled) {
    // Still render a stub for parent layout consistency, but no DOM cost.
    return null;
  }

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-testid="ink-cursor-layer"
    >
      {/* Hidden mirror for caret position math. */}
      <div
        ref={mirrorRef}
        className="invisible absolute left-0 top-0"
        style={{
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          overflow: "hidden",
        }}
      />
      {dots.map((d) => (
        <span
          key={d.id}
          className={cn(
            "absolute rounded-full bg-primary/40",
            "animate-[wn-ink-fade_260ms_ease-out_forwards]",
          )}
          style={{
            left: d.x,
            top: d.y,
            width: d.size,
            height: d.size,
          }}
        />
      ))}
    </div>
  );
}
