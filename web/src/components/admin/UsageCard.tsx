"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type AdminUsage } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  usage: AdminUsage | null;
  onRefreshed?: (next: AdminUsage) => void;
}

/**
 * Cloudflare resource-usage card. Shows daily metrics (workers requests,
 * D1 reads/writes, KV ops, Workers AI neurons) plus monthly R2 ops. Each
 * row renders a progress bar against the free-tier quota; >=80% trips the
 * warn style, >=100% turns destructive.
 */
export function UsageCard({ usage, onRefreshed }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      await api.adminUsageRefresh();
      // After refresh writes to KV, re-read the canonical /admin/usage shape.
      const next = await api.adminUsage();
      onRefreshed?.(next);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "새로고침에 실패했어요.";
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  }

  if (!usage) {
    return (
      <Card data-testid="usage-card">
        <CardHeader>
          <CardTitle>리소스 사용량</CardTitle>
          <CardDescription>불러오는 중...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (usage.source !== "kv" || !usage.snapshot) {
    return (
      <Card data-testid="usage-card">
        <CardHeader>
          <CardTitle>리소스 사용량</CardTitle>
          <CardDescription>
            아직 스냅샷이 없습니다. 아래 버튼을 누르거나 02:00 KST 크론을
            기다리세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
            data-testid="usage-refresh"
          >
            {refreshing ? "새로고침 중..." : "지금 새로고침"}
          </Button>
          {error ? (
            <span className="ml-2 text-xs text-destructive">{error}</span>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const s = usage.snapshot;
  const q = usage.quotas;

  const rows: { label: string; value: number | null; quota: number; period: "일" | "월" }[] = [
    { label: "Workers 요청", value: s.workers?.requests ?? null, quota: q.workersRequestsPerDay, period: "일" },
    { label: "Workers AI neurons", value: s.workersAi?.neurons ?? null, quota: q.workersAiNeuronsPerDay, period: "일" },
    { label: "D1 행 읽기", value: s.d1?.rowsRead ?? null, quota: q.d1RowsReadPerDay, period: "일" },
    { label: "D1 행 쓰기", value: s.d1?.rowsWritten ?? null, quota: q.d1RowsWrittenPerDay, period: "일" },
    { label: "KV 읽기", value: s.kv?.reads ?? null, quota: q.kvReadsPerDay, period: "일" },
    { label: "KV 쓰기", value: s.kv?.writes ?? null, quota: q.kvWritesPerDay, period: "일" },
    { label: "R2 Class A ops", value: s.r2?.classAOps ?? null, quota: q.r2ClassAOpsPerMonth, period: "월" },
    { label: "R2 Class B ops", value: s.r2?.classBOps ?? null, quota: q.r2ClassBOpsPerMonth, period: "월" },
    { label: "R2 저장 용량", value: s.r2?.storageBytes ?? null, quota: q.r2StorageBytes, period: "월" },
  ];

  const generated = new Date(s.generatedAt);
  const generatedLabel = `${generated.toLocaleString("ko-KR")}`;

  return (
    <Card data-testid="usage-card">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle>리소스 사용량 (무료 한도 기준)</CardTitle>
          <CardDescription>
            최근 24h · R2는 30일 누적 · 스냅샷 {generatedLabel}
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={refreshing}
          data-testid="usage-refresh"
        >
          {refreshing ? "새로고침 중..." : "새로고침"}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((r) => (
          <UsageRow key={r.label} {...r} />
        ))}
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

function UsageRow({
  label,
  value,
  quota,
  period,
}: {
  label: string;
  value: number | null;
  quota: number;
  period: "일" | "월";
}) {
  if (value === null) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">— / {formatNumber(quota, label)}</span>
      </div>
    );
  }
  const pct = quota > 0 ? Math.min(999, (value / quota) * 100) : 0;
  const danger = pct >= 100;
  const warn = !danger && pct >= 80;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span
          className={cn(
            "tabular-nums",
            danger
              ? "text-destructive"
              : warn
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
          )}
        >
          {formatNumber(value, label)} / {formatNumber(quota, label)} · {period} {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            danger
              ? "bg-destructive"
              : warn
                ? "bg-amber-500"
                : "bg-foreground/60",
          )}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function formatNumber(n: number, label: string): string {
  if (label.includes("저장 용량")) {
    if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GiB`;
    if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MiB`;
    if (n >= 1024) return `${(n / 1024).toFixed(0)} KiB`;
    return `${n} B`;
  }
  return n.toLocaleString("ko-KR");
}
