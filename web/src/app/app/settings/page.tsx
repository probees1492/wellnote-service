"use client";

import { useEffect, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api, type CreditTx } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";

const REMINDER_KEY = "wn:reminderOptIn";

export default function SettingsPage() {
  const user = useAuth((s) => s.user);
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<CreditTx[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [reminderOptIn, setReminderOptIn] = useState(false);
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">설정</h1>
      <Card>
        <CardHeader>
          <CardTitle>프로필</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">이메일</span>
            <span>{user?.email}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">표시 이름</span>
            <span>{user?.displayName}</span>
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
