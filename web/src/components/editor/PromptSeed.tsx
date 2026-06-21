"use client";

import { ArrowsClockwise, MagicWand } from "@phosphor-icons/react/dist/ssr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

const STORAGE_KEY = "wn:lastPromptIdx";

interface Prompt {
  topic: string;
  text: string;
}

interface Props {
  /** Called when the user accepts a prompt to seed the editor body. */
  onPick: (text: string) => void;
}

/**
 * "마중물" card — surfaces a Workers AI–generated prompt and lets the user tap
 * to drop it into the editor as a starter sentence. Reshuffles client-side so
 * users get a new suggestion without hitting the network again.
 */
export function PromptSeed({ onPick }: Props) {
  const [items, setItems] = useState<Prompt[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.todayPrompts();
        if (!alive) return;
        const shuffled = shuffle(r.items);
        setItems(shuffled);
        try {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored !== null) seenRef.current.add(stored);
        } catch {
          /* ignore */
        }
        // Skip past the last shown prompt if it's still in slot 0.
        const start = shuffled[0] && seenRef.current.has(shuffled[0].text) ? 1 : 0;
        setIndex(start % Math.max(1, shuffled.length));
      } catch {
        /* offline / 401 — quietly hide */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const current = items[index] ?? null;

  const reroll = useCallback(() => {
    if (items.length < 2) return;
    setIndex((i) => (i + 1) % items.length);
  }, [items.length]);

  const accept = useCallback(() => {
    if (!current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, current.text);
    } catch {
      /* ignore */
    }
    onPick(current.text);
  }, [current, onPick]);

  const topicLabel = useMemo(() => {
    if (!current) return "";
    return TOPIC_KO[current.topic] ?? current.topic;
  }, [current]);

  if (loading || !current) return null;

  return (
    <Card
      className="flex flex-wrap items-center justify-between gap-3 border bg-card/60 p-3 shadow-none"
      data-testid="prompt-seed"
    >
      <div className="flex min-w-0 items-center gap-2">
        <MagicWand
          className="h-4 w-4 shrink-0 text-muted-foreground"
          weight="duotone"
          aria-hidden
        />
        <span className="truncate font-serif text-sm" data-testid="prompt-seed-text">
          {current.text}
        </span>
        <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
          {topicLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reroll}
          data-testid="prompt-seed-reroll"
          aria-label="다른 추천"
          title="다른 추천"
        >
          <ArrowsClockwise className="h-4 w-4" weight="duotone" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={accept}
          data-testid="prompt-seed-accept"
        >
          이 문장으로 시작
        </Button>
      </div>
    </Card>
  );
}

const TOPIC_KO: Record<string, string> = {
  daily: "오늘",
  feeling: "감정",
  people: "사람",
  work: "일",
  creative: "창작",
  reflect: "회고",
  future: "미래",
};

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
