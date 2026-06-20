"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import { ActivityGrid } from "@/components/memo/ActivityGrid";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, type ActivityGrid as GridT } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { todayKst } from "@/lib/time";

export default function HomePage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [grid, setGrid] = useState<GridT | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const today = todayKst();

  useEffect(() => {
    let alive = true;
    // Start the grid from the user's signup date so brand-new accounts see a
    // grid that begins on day 1 rather than 364 days of empty cells.
    const signupDate = user?.createdAt?.slice(0, 10);
    (async () => {
      try {
        const [g, b] = await Promise.all([
          api.activityGrid(signupDate),
          api.creditBalance(),
        ]);
        if (!alive) return;
        setGrid(g);
        setBalance(b.balance);
      } catch (e: unknown) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "데이터 로드 실패";
        setErr(msg);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.createdAt]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            안녕하세요, {user?.displayName} 님
          </h1>
          <p className="text-sm text-muted-foreground">오늘 ({today})</p>
        </div>
        <div
          className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm shadow-sm"
          data-testid="credit-balance"
        >
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
          크래딧 <span className="font-semibold">{balance ?? "—"}</span>
        </div>
      </div>

      <Card
        className="cursor-pointer ring-offset-background transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => router.push("/app/today")}
        data-testid="today-cta"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") router.push("/app/today");
        }}
      >
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>오늘의 메모</CardTitle>
              <CardDescription>
                지금 바로 오늘의 한 페이지를 시작해 보세요.
              </CardDescription>
            </div>
            <Button>
              시작하기
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">활동 그리드</h2>
        {err ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
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
          <Button variant="outline">검색</Button>
        </Link>
      </div>
    </div>
  );
}
