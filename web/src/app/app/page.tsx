"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ActivityGrid } from "@/components/memo/ActivityGrid";
import { api, type ActivityGrid as GridT } from "@/lib/api";
import { todayKst } from "@/lib/time";
import { useAuth } from "@/lib/auth-store";

export default function HomePage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [grid, setGrid] = useState<GridT | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const today = todayKst();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [g, b] = await Promise.all([
          api.activityGrid(),
          api.creditBalance(),
        ]);
        if (!alive) return;
        setGrid(g);
        setBalance(b.balance);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "데이터 로드 실패");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            안녕하세요, {user?.displayName} 님
          </h1>
          <p className="text-sm text-text-muted">오늘 ({today})</p>
        </div>
        <div
          className="rounded-md border border-border bg-bg-secondary px-4 py-2 text-sm"
          data-testid="credit-balance"
        >
          크래딧:{" "}
          <span className="font-semibold text-edge-blue">
            {balance ?? "—"}
          </span>
        </div>
      </div>

      <Card
        className="cursor-pointer hover:shadow-xs border-l-[4px] border-l-edge-blue"
        onClick={() => router.push("/app/today")}
        data-testid="today-cta"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">오늘의 메모</h2>
            <p className="text-sm text-text-muted">
              지금 바로 오늘의 한 페이지를 시작해 보세요.
            </p>
          </div>
          <Button variant="primary">시작하기</Button>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">활동 그리드</h2>
        {err ? (
          <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {err}
          </div>
        ) : null}
        <ActivityGrid
          grid={grid}
          todayIso={today}
          onCellClick={(c) => {
            if (c.date === today) router.push("/app/today");
            else router.push(`/app/memo?date=${c.date}`);
          }}
        />
      </div>

      <div className="flex justify-end">
        <Link href="/app/search">
          <Button variant="secondary">검색</Button>
        </Link>
      </div>
    </div>
  );
}
