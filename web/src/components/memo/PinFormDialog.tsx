"use client";

import * as React from "react";
import { Globe, Lock } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  PIN_COLOR_HEAD_CLASS,
  PIN_COLORS,
} from "@/components/memo/pin-colors";
import type { PinColor, PinVisibility } from "@/lib/api";

interface PinFormValues {
  name: string;
  color: PinColor;
  visibility: PinVisibility;
}

interface PinFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<PinFormValues>;
  title: string;
  description?: string;
  submitLabel: string;
  onSubmit: (values: PinFormValues) => Promise<void>;
  busyLabel?: string;
}

/** Modal form used for both create and edit. */
export function PinFormDialog({
  open,
  onOpenChange,
  initial,
  title,
  description,
  submitLabel,
  onSubmit,
  busyLabel,
}: PinFormDialogProps) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [color, setColor] = React.useState<PinColor>(
    initial?.color ?? "yellow",
  );
  const [visibility, setVisibility] = React.useState<PinVisibility>(
    initial?.visibility ?? "private",
  );
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Reset when dialog opens with new initial values.
  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setColor(initial?.color ?? "yellow");
      setVisibility(initial?.visibility ?? "private");
      setErr(null);
    }
  }, [open, initial?.name, initial?.color, initial?.visibility]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length >= 1 && trimmed.length <= 40 && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({ name: trimmed, color, visibility });
      onOpenChange(false);
    } catch (ex: unknown) {
      const msg = ex instanceof Error ? ex.message : "저장에 실패했습니다.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!busy ? onOpenChange(v) : null)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pin-name">이름</Label>
            <Input
              id="pin-name"
              data-testid="pin-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="예: 영감, 책 메모, 여행"
              autoFocus
              required
            />
            <div className="text-right text-xs text-muted-foreground">
              {trimmed.length}/40
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>색</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PIN_COLORS) as PinColor[]).map((c) => {
                const active = c === color;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={active}
                    data-testid={`pin-color-${c}`}
                    onClick={() => setColor(c)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform",
                      active
                        ? "border-foreground scale-110"
                        : "border-transparent opacity-80 hover:opacity-100",
                    )}
                  >
                    <span
                      className={cn(
                        "wn-pushpin h-5 w-5",
                        PIN_COLOR_HEAD_CLASS[c],
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>공개</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={visibility === "private"}
                onClick={() => setVisibility("private")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  visibility === "private"
                    ? "border-foreground bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60",
                )}
              >
                <Lock className="h-4 w-4" weight="duotone" aria-hidden />
                비공개
              </button>
              <button
                type="button"
                aria-pressed={visibility === "public"}
                onClick={() => setVisibility("public")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  visibility === "public"
                    ? "border-foreground bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60",
                )}
              >
                <Globe className="h-4 w-4" weight="duotone" aria-hidden />
                공개
              </button>
            </div>
          </div>

          {err ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {err}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              취소
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {busy ? (busyLabel ?? "저장 중...") : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
