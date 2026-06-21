"use client";

import { Pause, Play, SpeakerHigh, Stop } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { useTts } from "@/lib/use-tts";
import { cn } from "@/lib/utils";

interface TtsControlsProps {
  /** Plain text to read. Markdown is stripped before being passed in. */
  text: string;
  className?: string;
}

const RATES = [0.75, 1, 1.25, 1.5] as const;

/**
 * Compact TTS controls — sits under or beside a memo body. Uses the
 * browser's SpeechSynthesis (no server). Falls back to nothing when the
 * API is unavailable.
 */
export function TtsControls({ text, className }: TtsControlsProps) {
  const tts = useTts();
  if (!tts.supported) return null;

  const onPlay = () => {
    if (tts.speaking) {
      if (tts.paused) tts.resume();
      else tts.pause();
    } else {
      tts.speak(text);
    }
  };

  const onStop = () => tts.stop();

  const playLabel = !tts.speaking
    ? "읽어주기"
    : tts.paused
      ? "이어 읽기"
      : "일시정지";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-sm text-muted-foreground",
        className,
      )}
      data-testid="tts-controls"
    >
      <SpeakerHigh className="h-4 w-4" weight="duotone" aria-hidden />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onPlay}
        data-testid="tts-play"
        data-state={tts.speaking ? (tts.paused ? "paused" : "playing") : "idle"}
      >
        {tts.speaking && !tts.paused ? (
          <Pause className="mr-1 h-4 w-4" weight="duotone" />
        ) : (
          <Play className="mr-1 h-4 w-4" weight="duotone" />
        )}
        {playLabel}
      </Button>
      {tts.speaking ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onStop}
          data-testid="tts-stop"
        >
          <Stop className="mr-1 h-4 w-4" weight="duotone" />
          정지
        </Button>
      ) : null}
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label="재생 속도"
      >
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={Math.abs(tts.rate - r) < 0.01}
            onClick={() => tts.setRate(r)}
            data-testid={`tts-rate-${r}`}
            className={cn(
              "rounded px-2 py-0.5 text-xs transition-colors",
              Math.abs(tts.rate - r) < 0.01
                ? "bg-foreground text-background"
                : "border bg-background hover:bg-accent",
            )}
          >
            {r}x
          </button>
        ))}
      </div>
      {tts.voice ? (
        <span className="hidden truncate text-xs sm:inline" title={tts.voice.name}>
          {tts.voice.name}
        </span>
      ) : null}
    </div>
  );
}
