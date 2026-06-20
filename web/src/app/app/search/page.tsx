"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
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
      } catch (e: any) {
        setErr(e?.message ?? "검색 실패");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [q, from, to]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">검색</h1>
      <Input
        id="search-q"
        label="검색어"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="제목/본문에서 검색"
        data-testid="search-input"
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="from"
          label="시작일"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          id="to"
          label="종료일"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      {err ? (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {err}
        </div>
      ) : null}
      <div
        className="flex flex-col gap-2"
        data-testid="search-results"
        data-loading={loading ? "true" : "false"}
      >
        {items.length === 0 ? (
          <div className="text-sm text-text-muted">결과가 없습니다.</div>
        ) : (
          items.map((m) => (
            <Link key={m.id} href={`/app/memo/${m.dateKst}`}>
              <Card className="hover:shadow-xs">
                <div className="flex items-baseline justify-between">
                  <div className="font-medium">{m.title || m.dateKst}</div>
                  <div className="text-xs text-text-muted">{m.dateKst}</div>
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  {m.charCount}자
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
