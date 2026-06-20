"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getSpeechRecognitionCtor,
  isSafari,
  isSpeechRecognitionSupported,
  type RecognitionState,
  type SpeechRecognitionErrorEvent,
  type SpeechRecognitionEvent,
  type SpeechRecognitionInstance,
} from "@/lib/speech-recognition";

interface SpeechToTextButtonProps {
  /**
   * Called with the latest final transcript chunk. The host component is
   * responsible for inserting it at the textarea cursor.
   */
  onTranscript: (text: string) => void;
  /**
   * Optional callback when an interim (live) transcript chunk is produced.
   * Hosts may use this to show a ghost preview; we do not require it.
   */
  onInterim?: (text: string) => void;
  /**
   * Optional callback to surface user-facing errors (permission denied, etc.).
   */
  onError?: (message: string) => void;
  /** Mirrors disabled state from the host (e.g., while memo is loading). */
  disabled?: boolean;
  className?: string;
}

/**
 * Microphone button that toggles Web Speech recognition in Korean.
 *
 * Behavior:
 *  - Detects browser support on mount; disables itself when unsupported.
 *  - On click: requests mic permission, starts ko-KR recognition.
 *  - Streams interim results via onInterim, final segments via onTranscript.
 *  - On second click, or on `onend`, returns to idle.
 */
export function SpeechToTextButton({
  onTranscript,
  onInterim,
  onError,
  disabled,
  className,
}: SpeechToTextButtonProps) {
  const [state, setState] = useState<RecognitionState>("idle");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const stoppingRef = useRef(false);

  // Detect support on mount (client-only).
  useEffect(() => {
    if (!isSpeechRecognitionSupported()) {
      setState("unsupported");
    }
  }, []);

  // Clean up any active recognition session on unmount.
  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.onresult = null;
          rec.onerror = null;
          rec.onend = null;
          rec.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    stoppingRef.current = true;
    try {
      rec.stop();
    } catch {
      // ignore
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setState("unsupported");
      return;
    }

    // Tear down any previous instance.
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    const rec = new Ctor();
    rec.lang = "ko-KR";
    // Safari's continuous mode is flaky — single-utterance there.
    rec.continuous = !isSafari();
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      stoppingRef.current = false;
      setState("listening");
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const alt = result[0];
        if (!alt) continue;
        if (result.isFinal) {
          finalChunk += alt.transcript;
        } else {
          interimChunk += alt.transcript;
        }
      }
      if (finalChunk) {
        onTranscript(finalChunk);
      }
      if (interimChunk && onInterim) {
        onInterim(interimChunk);
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = event.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setState("denied");
        onError?.("마이크 권한이 필요합니다.");
      } else if (code === "no-speech") {
        // Browser will fire onend right after; ignore.
      } else if (code === "aborted") {
        // User-initiated stop.
      } else {
        onError?.(`음성 인식 오류: ${code}`);
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      stoppingRef.current = false;
      setState((prev) => (prev === "denied" ? prev : "idle"));
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      // start() throws if already started — reset state defensively.
      recognitionRef.current = null;
      setState("idle");
      const msg = err instanceof Error ? err.message : "음성 인식 시작 실패";
      onError?.(msg);
    }
  }, [onError, onInterim, onTranscript]);

  const handleClick = useCallback(() => {
    if (state === "listening") {
      stop();
    } else if (state === "idle" || state === "denied") {
      start();
    }
  }, [start, state, stop]);

  const isUnsupported = state === "unsupported";
  const isListening = state === "listening";
  const buttonDisabled = disabled || isUnsupported;

  const title = isUnsupported
    ? "이 브라우저는 음성 입력을 지원하지 않습니다"
    : isListening
      ? "음성 입력 중지"
      : "음성 입력 시작";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isListening ? (
        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          data-testid="stt-indicator"
        >
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
          </span>
          듣는 중...
        </span>
      ) : null}
      <Button
        type="button"
        variant={isListening ? "default" : "outline"}
        size="icon"
        onClick={handleClick}
        disabled={buttonDisabled}
        title={title}
        aria-label={title}
        aria-pressed={isListening}
        data-testid="stt-button"
        data-state={state}
        className={cn(
          "h-9 w-9 transition-colors",
          isListening && "animate-pulse",
        )}
      >
        {isUnsupported ? (
          <MicOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Mic className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
