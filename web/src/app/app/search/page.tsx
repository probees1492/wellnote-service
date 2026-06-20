"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Memo } from "@/lib/api";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<Memo[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await api.searchMemos(q, from || undefined, to || undefined);
        setItems(r.items);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "검색 실패";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [q, from, to]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">검색</h1>
      <div className="flex flex-col gap-2">
        <Label htmlFor="search-q">검색어</Label>
        <Input
          id="search-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목/본문에서 검색"
          data-testid="search-input"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="from">시작일</Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="to">종료일</Label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>
      {err ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      ) : null}
      <div
        className="flex flex-col gap-2"
        data-testid="search-results"
        data-loading={loading ? "true" : "false"}
      >
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">결과가 없습니다.</div>
        ) : (
          items.map((m) => (
            <Link key={m.id} href={`/app/memo?date=${m.dateKst}`}>
              <Card className="transition hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-baseline justify-between">
                    <div className="font-medium">{m.title || m.dateKst}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.dateKst}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {m.charCount}자
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
