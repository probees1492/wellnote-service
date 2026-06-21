"use client";

import * as React from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, type Pin } from "@/lib/api";
import { cn } from "@/lib/utils";

import { PIN_COLOR_HEAD_CLASS } from "./pin-colors";

interface PinPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently attached pin (if any) — clicking the same row detaches. */
  currentPinId: string | null;
  onPick: (pinId: string | null) => Promise<void>;
  /** Called when the user wants to create a new pin; consumer should close
   *  this dialog and open its own create flow. */
  onRequestCreate: () => void;
}

/** Modal: pick a pin to attach this memo to. The "create" path is handed
 *  back to the parent so we never nest two Radix dialogs. */
export function PinPickerDialog({
  open,
  onOpenChange,
  currentPinId,
  onPick,
  onRequestCreate,
}: PinPickerDialogProps) {
  const [pins, setPins] = React.useState<Pin[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | "__none__" | null>(null);

  const loadPins = React.useCallback(async () => {
    setErr(null);
    try {
      const r = await api.pins.list();
      setPins(r.items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "핀 목록을 불러오지 못했습니다.";
      setErr(msg);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      setPins(null);
      void loadPins();
    }
  }, [open, loadPins]);

  const handlePick = async (pinId: string | null) => {
    setBusyId(pinId ?? "__none__");
    try {
      await onPick(pinId);
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "핀 변경에 실패했습니다.";
      setErr(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="pin-picker">
        <DialogHeader>
          <DialogTitle>핀에 꽂기</DialogTitle>
          <DialogDescription>
            이 메모를 분류할 핀을 선택하세요.
          </DialogDescription>
        </DialogHeader>

        {err ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {err}
          </div>
        ) : null}

        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {pins === null ? (
            <div className="px-2 py-3 text-sm text-muted-foreground">
              불러오는 중...
            </div>
          ) : pins.length === 0 ? (
            <div className="px-2 py-3 text-sm text-muted-foreground">
              아직 핀이 없어요. 아래에서 새 핀을 만들어보세요.
            </div>
          ) : (
            pins.map((p) => {
              const active = p.id === currentPinId;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`pin-option-${p.id}`}
                  disabled={busyId !== null}
                  onClick={() => handlePick(active ? null : p.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/60",
                    busyId === p.id && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "wn-pushpin h-3.5 w-3.5",
                      PIN_COLOR_HEAD_CLASS[p.color],
                    )}
                  />
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.memoCount ?? 0}
                  </span>
                  {active ? (
                    <span className="text-xs text-muted-foreground">떼기</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onRequestCreate}
          data-testid="pin-picker-create"
          disabled={busyId !== null}
        >
          <Plus className="h-4 w-4" weight="duotone" aria-hidden />
          새 핀 만들기
        </Button>

        <DialogFooter>
          {currentPinId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => handlePick(null)}
              disabled={busyId !== null}
            >
              핀에서 떼기
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busyId !== null}
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
