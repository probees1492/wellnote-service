"use client";

import { useEffect, useState } from "react";

import { RenameDisplayNameDialog } from "@/components/profile/RenameDisplayNameDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api, type ApiUser, type CreditTx } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import {
  DEFAULT_PREFS,
  type EditorPrefs,
  type GridStyle,
  loadEditorPrefs,
  saveEditorPrefs,
} from "@/lib/editor-prefs";
import { cn } from "@/lib/utils";

const REMINDER_KEY = "wn:reminderOptIn";

export default function SettingsPage() {
  const user = useAuth((s) => s.user);
  const refreshMe = useAuth((s) => s.refreshMe);
  const [renameOpen, setRenameOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<CreditTx[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [reminderOptIn, setReminderOptIn] = useState(false);
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [editorPrefs, setEditorPrefs] = useState<EditorPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setEditorPrefs(loadEditorPrefs());
  }, []);

  function updatePrefs(patch: Partial<EditorPrefs>) {
    setEditorPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveEditorPrefs(next);
      return next;
    });
  }

  // Hydrate local preference + browser permission on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setReminderOptIn(
        window.localStorage.getItem(REMINDER_KEY) === "true",
      );
    } catch {
      /* ignore */
    }
    if (typeof Notification === "undefined") {
      setNotifPermission("unsupported");
    } else {
      setNotifPermission(Notification.permission);
    }
  }, []);

  async function handleReminderToggle(next: boolean) {
    setReminderOptIn(next);
    try {
      window.localStorage.setItem(REMINDER_KEY, String(next));
    } catch {
      /* ignore */
    }
    if (next && typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        try {
          const p = await Notification.requestPermission();
          setNotifPermission(p);
        } catch {
          /* ignore */
        }
      } else {
        setNotifPermission(Notification.permission);
      }
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [b, t] = await Promise.all([
          api.creditBalance(),
          api.creditTransactions(),
        ]);
        if (!alive) return;
        setBalance(b.balance);
        setTxs(t.items);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "정보를 불러오지 못했습니다.";
        setErr(msg);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function handleRenamed(_next: ApiUser) {
    // The dialog already mutated the API response; refresh /auth/me so the
    // shared zustand store reflects the new name everywhere (Header, etc.).
    void refreshMe();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">설정</h1>
      {user ? (
        <RenameDisplayNameDialog
          open={renameOpen}
          onOpenChange={setRenameOpen}
          user={user}
          onRenamed={handleRenamed}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>프로필</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">이메일</span>
            <span>{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">필명</span>
            <div className="flex items-center gap-2">
              <span>{user?.displayName}</span>
              {user ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRenameOpen(true)}
                  data-testid="rename-displayname-button"
                >
                  변경
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">역할</span>
            <span>{user?.role}</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>알림</CardTitle>
          <CardDescription>
            매일 22:00 KST에 메모 작성 리마인더를 받습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <Label
            htmlFor="reminder-toggle"
            className="flex cursor-pointer items-center justify-between gap-3"
          >
            <span>메모 작성 리마인더 받기</span>
            <Checkbox
              id="reminder-toggle"
              checked={reminderOptIn}
              onCheckedChange={handleReminderToggle}
              data-testid="reminder-toggle"
            />
          </Label>
          {reminderOptIn ? (
            <p
              className="mt-2 text-xs text-muted-foreground"
              data-testid="reminder-status"
            >
              {notifPermission === "granted"
                ? "브라우저 알림이 허용되었습니다. 이 브라우저가 열려 있는 동안 22:00 KST에 알림이 표시됩니다."
                : notifPermission === "denied"
                  ? "브라우저 알림이 차단되어 있습니다. 브라우저 설정에서 허용해 주세요."
                  : notifPermission === "unsupported"
                    ? "이 브라우저는 알림을 지원하지 않습니다."
                    : "브라우저 알림 허용 요청을 처리하는 중입니다."}
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>에디터 — 고급</CardTitle>
          <CardDescription>
            기본은 깨끗한 화면입니다. 종이 질감·봉인 도장 같은 장식을 켜고
            싶다면 아래에서 하나씩 활성화하세요.
          </CardDescription>
        </CardHeader>
        <CardContent
          className="flex flex-col gap-4 text-sm"
          data-testid="editor-settings"
        >
          <div className="flex flex-col gap-2">
            <span className="font-medium">종이 스타일</span>
            <div
              className="grid grid-cols-4 gap-2"
              role="radiogroup"
              aria-label="종이 스타일"
            >
              {(
                [
                  { v: "off", label: "끄기 (기본)" },
                  { v: "manuscript", label: "정통 200자" },
                  { v: "lines", label: "가로선" },
                  { v: "dots", label: "점 격자" },
                ] as { v: GridStyle; label: string }[]
              ).map((opt) => {
                const active = editorPrefs.gridStyle === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => updatePrefs({ gridStyle: opt.v })}
                    data-testid={`grid-style-${opt.v}`}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <Label
            htmlFor="pref-typewriter"
            className="flex cursor-pointer items-center justify-between gap-3"
          >
            <span>타이프라이터 모드 (현재 줄을 중앙에)</span>
            <Checkbox
              id="pref-typewriter"
              checked={editorPrefs.typewriter}
              onCheckedChange={(v) => updatePrefs({ typewriter: v })}
              data-testid="pref-typewriter"
            />
          </Label>
          <Label
            htmlFor="pref-indent"
            className="flex cursor-pointer items-center justify-between gap-3"
          >
            <span>첫 줄 들여쓰기</span>
            <Checkbox
              id="pref-indent"
              checked={editorPrefs.firstLineIndent}
              onCheckedChange={(v) => updatePrefs({ firstLineIndent: v })}
              data-testid="pref-indent"
            />
          </Label>
          <Label
            htmlFor="pref-ink"
            className="flex cursor-pointer items-center justify-between gap-3"
          >
            <span>잉크 커서 효과</span>
            <Checkbox
              id="pref-ink"
              checked={editorPrefs.inkCursor}
              onCheckedChange={(v) => updatePrefs({ inkCursor: v })}
              data-testid="pref-ink"
            />
          </Label>
          <Label
            htmlFor="pref-pen"
            className="flex cursor-pointer items-center justify-between gap-3"
          >
            <span>펜 사각 소리</span>
            <Checkbox
              id="pref-pen"
              checked={editorPrefs.penSound}
              onCheckedChange={(v) => updatePrefs({ penSound: v })}
              data-testid="pref-pen"
            />
          </Label>
          <Label
            htmlFor="pref-seal"
            className="flex cursor-pointer items-center justify-between gap-3"
          >
            <span>봉인 카운트다운 표시</span>
            <Checkbox
              id="pref-seal"
              checked={editorPrefs.sealCountdown}
              onCheckedChange={(v) => updatePrefs({ sealCountdown: v })}
              data-testid="pref-seal"
            />
          </Label>
          <Label
            htmlFor="pref-stamp"
            className="flex cursor-pointer items-center justify-between gap-3"
          >
            <span>자정 봉인 도장 애니메이션</span>
            <Checkbox
              id="pref-stamp"
              checked={editorPrefs.sealStamp}
              onCheckedChange={(v) => updatePrefs({ sealStamp: v })}
              data-testid="pref-stamp"
            />
          </Label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>크래딧</CardTitle>
          <CardDescription>현재 잔액</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="text-3xl font-semibold tracking-tight"
            data-testid="settings-balance"
          >
            {balance ?? "—"}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>트랜잭션</CardTitle>
        </CardHeader>
        <CardContent>
          {err ? (
            <div className="text-sm text-destructive">{err}</div>
          ) : txs.length === 0 ? (
            <div className="text-sm text-muted-foreground">내역이 없습니다.</div>
          ) : (
            <ul className="divide-y">
              {txs.map((t) => (
                <li key={t.id} className="flex justify-between py-2 text-sm">
                  <span>
                    <span
                      className={
                        t.delta >= 0 ? "font-medium" : "text-destructive"
                      }
                    >
                      {t.delta >= 0 ? "+" : ""}
                      {t.delta}
                    </span>{" "}
                    <span className="text-muted-foreground">({t.reason})</span>
                  </span>
                  <span className="text-muted-foreground">{t.createdAt}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
