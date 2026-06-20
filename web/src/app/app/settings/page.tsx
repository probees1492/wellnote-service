"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
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
      } catch (e: any) {
        setErr(e?.message ?? "정보를 불러오지 못했습니다.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">설정</h1>
      <Card>
        <h2 className="text-lg font-semibold">프로필</h2>
        <div className="mt-3 text-sm text-text-secondary">
          <div>
            <span className="text-text-muted">이메일: </span>
            {user?.email}
          </div>
          <div>
            <span className="text-text-muted">표시 이름: </span>
            {user?.displayName}
          </div>
          <div>
            <span className="text-text-muted">역할: </span>
            {user?.role}
          </div>
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold">크래딧</h2>
        <div
          className="mt-2 text-2xl font-bold text-edge-blue"
          data-testid="settings-balance"
        >
          {balance ?? "—"}
        </div>
        <p className="text-xs text-text-muted">현재 잔액</p>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold">트랜잭션</h2>
        {err ? (
          <div className="mt-2 text-sm text-danger">{err}</div>
        ) : txs.length === 0 ? (
          <div className="mt-2 text-sm text-text-muted">내역이 없습니다.</div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {txs.map((t) => (
              <li key={t.id} className="py-2 text-sm flex justify-between">
                <span>
                  <span
                    className={
                      t.delta >= 0 ? "text-edge-blue" : "text-danger"
                    }
                  >
                    {t.delta >= 0 ? "+" : ""}
                    {t.delta}
                  </span>{" "}
                  <span className="text-text-muted">({t.reason})</span>
                </span>
                <span className="text-text-muted">{t.createdAt}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
