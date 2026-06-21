"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
import { api, type ApiUser } from "@/lib/api";
import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  type DisplayNameReason,
  displayNameReasonLabel,
  validateDisplayNameClient,
} from "@/lib/auth-store";

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; value: string }
  | { status: "unavailable"; reason: DisplayNameReason };

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ApiUser;
  onRenamed: (user: ApiUser) => void;
}

export function RenameDisplayNameDialog({
  open,
  onOpenChange,
  user,
  onRenamed,
}: Props) {
  const [value, setValue] = useState(user.displayName);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [check, setCheck] = useState<CheckState>({ status: "idle" });
  const debounceRef = useRef<number | null>(null);

  const cooldown = useMemo(() => describeCooldown(user.displayNameChangedAt), [
    user.displayNameChangedAt,
  ]);

  // Reset state every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setValue(user.displayName);
    setError(null);
    setCheck({ status: "idle" });
  }, [open, user.displayName]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === user.displayName.toLowerCase()) {
      setCheck({ status: "idle" });
      return;
    }
    const local = validateDisplayNameClient(trimmed);
    if (!local.ok) {
      setCheck({ status: "unavailable", reason: local.reason });
      return;
    }
    setCheck({ status: "checking" });
    debounceRef.current = window.setTimeout(async () => {
      try {
        const r = await api.checkDisplayName(local.value);
        if (r.available) {
          setCheck({ status: "available", value: local.value });
        } else {
          setCheck({
            status: "unavailable",
            reason: r.reason ?? "taken",
          });
        }
      } catch {
        setCheck({ status: "idle" });
      }
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, user.displayName]);

  async function handleSave() {
    setError(null);
    const local = validateDisplayNameClient(value);
    if (!local.ok) {
      setError(displayNameReasonLabel(local.reason));
      return;
    }
    if (local.value.toLowerCase() === user.displayName.toLowerCase()) {
      onOpenChange(false);
      return;
    }
    if (check.status === "unavailable") {
      setError(displayNameReasonLabel(check.reason));
      return;
    }
    setLoading(true);
    try {
      const r = await api.renameDisplayName(local.value);
      onRenamed(r.user);
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "필명을 변경하지 못했습니다.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const cooldownActive = cooldown !== null;
  const submitDisabled =
    loading ||
    cooldownActive ||
    check.status === "checking" ||
    check.status === "unavailable" ||
    value.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>필명 변경</DialogTitle>
          <DialogDescription>
            필명은 24시간에 한 번만 변경할 수 있어요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-displayname">새 필명</Label>
            <Input
              id="rename-displayname"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              minLength={DISPLAY_NAME_MIN}
              maxLength={DISPLAY_NAME_MAX}
              disabled={cooldownActive || loading}
              data-testid="rename-displayname-input"
            />
            <CheckHelp state={check} />
          </div>
          {cooldownActive ? (
            <div
              className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
              data-testid="rename-cooldown"
            >
              {cooldown.label}
            </div>
          ) : null}
          {error ? (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-testid="rename-error"
            >
              {error}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={submitDisabled}
            data-testid="rename-submit"
          >
            {loading ? "변경 중..." : "변경"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckHelp({ state }: { state: CheckState }) {
  if (state.status === "idle") {
    return (
      <span className="text-xs text-muted-foreground">
        2–20자, 한글·영문·숫자·공백·_-. 만 사용
      </span>
    );
  }
  if (state.status === "checking") {
    return <span className="text-xs text-muted-foreground">확인 중...</span>;
  }
  if (state.status === "available") {
    return (
      <span className="text-xs text-emerald-600 dark:text-emerald-400">
        사용 가능한 필명입니다.
      </span>
    );
  }
  return (
    <span className="text-xs text-destructive">
      {displayNameReasonLabel(state.reason)}
    </span>
  );
}

function describeCooldown(changedAt: string | null): { label: string } | null {
  if (!changedAt) return null;
  const elapsed = Date.now() - Date.parse(changedAt);
  if (!Number.isFinite(elapsed) || elapsed >= COOLDOWN_MS) return null;
  const remainingMs = COOLDOWN_MS - elapsed;
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0 || hours === 0) parts.push(`${minutes}분`);
  return { label: `${parts.join(" ")} 후에 다시 변경할 수 있어요.` };
}
