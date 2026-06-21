"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UsageCard } from "@/components/admin/UsageCard";
import {
  api,
  type AdminStatsOverview,
  type AdminUsage,
  type AdminUserRow,
} from "@/lib/api";

export default function AdminDashboard() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStatsOverview | null>(null);
  const [usage, setUsage] = useState<AdminUsage | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.adminListUsers({ q });
        if (!alive) return;
        setRows(r.items);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "사용자 목록을 불러오지 못했습니다.";
        setErr(msg);
      }
    })();
    return () => {
      alive = false;
    };
  }, [q]);

  // Stats fetched once on mount; cheap (single D1.batch call) so no debounce.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.adminStatsOverview();
        if (alive) setStats(r);
      } catch {
        /* silent — primary surface (user list) still works */
      }
      try {
        const u = await api.adminUsage();
        if (alive) setUsage(u);
      } catch {
        /* silent */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Admin 대시보드</h1>

      <KpiGrid stats={stats} />

      <UsageCard usage={usage} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="admin-q">이메일로 검색</Label>
        <Input
          id="admin-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {err ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      ) : null}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">이메일</th>
                <th className="px-4 py-3 font-medium">필명</th>
                <th className="px-4 py-3 font-medium">크래딧</th>
                <th className="px-4 py-3 font-medium">역할</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    사용자가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.displayName}</td>
                    <td className="px-4 py-3">{u.creditBalance}</td>
                    <td className="px-4 py-3">{u.role ?? "user"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users?id=${u.id}`}
                        className="font-medium underline"
                      >
                        상세
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiGrid({ stats }: { stats: AdminStatsOverview | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <KpiCard
        label="전체 가입자"
        value={stats?.totalUsers}
        sub={
          stats
            ? `정지 ${stats.suspendedUsers}명`
            : undefined
        }
        testid="kpi-total-users"
      />
      <KpiCard
        label="오늘 가입"
        value={stats?.signupsToday}
        sub={
          stats
            ? `7일 ${stats.signupsLast7d} · 30일 ${stats.signupsLast30d}`
            : undefined
        }
        testid="kpi-signups-today"
      />
      <KpiCard
        label="오늘 메모"
        value={stats?.memosToday}
        sub={
          stats
            ? `DAU ${stats.dailyActiveUsers}명`
            : undefined
        }
        testid="kpi-memos-today"
      />
      <KpiCard
        label="총 메모"
        value={stats?.totalMemos}
        sub={
          stats ? `평균 ${stats.avgCharCount}자` : undefined
        }
        testid="kpi-total-memos"
      />
      <KpiCard
        label="크래딧 합계"
        value={stats?.totalCredits}
        sub={stats ? `1인 평균 ${stats.avgCredits}` : undefined}
        testid="kpi-total-credits"
      />
      <KpiCard
        label="버디 팔로우 수"
        value={stats?.totalFollows}
        testid="kpi-total-follows"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  testid,
}: {
  label: string;
  value: number | undefined;
  sub?: string;
  testid?: string;
}) {
  return (
    <Card data-testid={testid}>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums tracking-tight">
          {value === undefined ? "—" : value.toLocaleString("ko-KR")}
        </span>
        {sub ? (
          <span className="text-xs text-muted-foreground">{sub}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
