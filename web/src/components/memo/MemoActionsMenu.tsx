"use client";

import * as React from "react";
import { DotsThree, PushPin, PushPinSlash } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";

import { PinFormDialog } from "./PinFormDialog";
import { PinPickerDialog } from "./PinPickerDialog";

interface MemoActionsMenuProps {
  memoId: string;
  pinId: string | null;
  onPinChanged?: (pinId: string | null) => void;
  /** Optional pin name to display on the "X 핀에서 떼기" item. */
  pinName?: string | null;
}

/** Compact "⋯" menu shown on memo cards. Currently exposes pin actions. */
export function MemoActionsMenu({
  memoId,
  pinId,
  onPinChanged,
  pinName,
}: MemoActionsMenuProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const detach = async () => {
    setBusy(true);
    try {
      await api.memos.setPin(memoId, null);
      onPinChanged?.(null);
    } finally {
      setBusy(false);
    }
  };

  const handlePick = async (next: string | null) => {
    await api.memos.setPin(memoId, next);
    onPinChanged?.(next);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="메모 메뉴"
            data-testid="memo-actions-trigger"
            disabled={busy}
          >
            <DotsThree className="h-5 w-5" weight="bold" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            data-testid="memo-actions-pin"
            onSelect={(e) => {
              e.preventDefault();
              setPickerOpen(true);
            }}
          >
            <PushPin className="h-4 w-4" weight="duotone" aria-hidden />
            {pinId ? "다른 핀에 꽂기" : "핀에 꽂기"}
          </DropdownMenuItem>
          {pinId ? (
            <DropdownMenuItem
              data-testid="memo-actions-detach"
              onSelect={(e) => {
                e.preventDefault();
                void detach();
              }}
            >
              <PushPinSlash className="h-4 w-4" weight="duotone" aria-hidden />
              {pinName ? `${pinName} 핀에서 떼기` : "핀에서 떼기"}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <PinPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        currentPinId={pinId}
        onPick={handlePick}
        onRequestCreate={() => {
          // Close picker first to avoid nested Radix Dialog portal issues,
          // then open the create form.
          setPickerOpen(false);
          // Defer to next tick so the picker's close animation/effects settle
          // before we mount the second dialog.
          setTimeout(() => setCreateOpen(true), 0);
        }}
      />

      <PinFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="새 핀 만들기"
        submitLabel="만들고 꽂기"
        onSubmit={async (vals) => {
          const created = await api.pins.create(vals);
          await api.memos.setPin(memoId, created.id);
          onPinChanged?.(created.id);
        }}
      />
    </>
  );
}
