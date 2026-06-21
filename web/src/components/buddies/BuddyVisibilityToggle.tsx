"use client";

import { Globe, Lock } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Visibility = "public" | "private";

interface BuddyVisibilityToggleProps {
  value: Visibility;
  /** Called after a successful server update so the parent can refresh me. */
  onChanged?: (next: Visibility) => void;
}

/**
 * Public/Private radio-pair for the "내가 팔로우하는 사람" list visibility.
 * Optimistically updates local state and calls the API; reverts on failure.
 */
export function BuddyVisibilityToggle({
  value,
  onChanged,
}: BuddyVisibilityToggleProps) {
  const [current, setCurrent] = useState<Visibility>(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Sync if the user object changes elsewhere (e.g. refreshMe after dialog).
  useEffect(() => {
    setCurrent(value);
  }, [value]);

  async function pick(next: Visibility) {
    if (busy || next === current) return;
    setBusy(true);
    setErr(null);
    const prev = current;
    setCurrent(next);
    try {
      await api.buddies.setVisibility(next);
      onChanged?.(next);
    } catch (e: unknown) {
      setCurrent(prev);
      const msg = e instanceof Error ? e.message : "변경에 실패했어요.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  const options: {
    value: Visibility;
    label: string;
    icon: typeof Globe;
    hint: string;
  }[] = [
    {
      value: "public",
      label: "공개",
      icon: Globe,
      hint: "다른 사용자가 내가 팔로우하는 사람을 볼 수 있어요.",
    },
    {
      value: "private",
      label: "비공개",
      icon: Lock,
      hint: "나만 볼 수 있어요.",
    },
  ];

  return (
    <div className="flex flex-col gap-2" data-testid="buddy-visibility">
      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label="버디 공개 설정"
      >
        {options.map((opt) => {
          const active = current === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy}
              onClick={() => void pick(opt.value)}
              data-testid={`buddy-visibility-${opt.value}`}
              className={cn(
                "flex flex-col items-start gap-1 rounded-md border px-3 py-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10 font-semibold text-foreground"
                  : "border-input bg-background hover:bg-accent",
              )}
            >
              <span className="flex items-center gap-2 text-sm">
                <Icon className="h-4 w-4" weight="duotone" aria-hidden />
                {opt.label}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {opt.hint}
              </span>
            </button>
          );
        })}
      </div>
      {err ? (
        <span className="text-xs text-destructive">{err}</span>
      ) : null}
    </div>
  );
}
