"use client";

import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, type CreditTx } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";

export default function SettingsPage() {
  const user = useAuth((s) => s.user);
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<CreditTx[]>([]);
  const [err, setErr] = useState<string | null>(null);

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
