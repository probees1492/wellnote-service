"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, type MemoWithBody } from "@/lib/api";
import { todayKst } from "@/lib/time";
import { Button } from "@/components/ui/Button";

function MemoByDateInner() {
  const params = useSearchParams();
  const date = params.get("date") ?? "";
  const router = useRouter();
  const today = todayKst();
  const [memo, setMemo] = useState<MemoWithBody | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    if (!date) {
      router.replace("/app");
      return;
    }
    (async () => {
      try {
        if (date === today) {
          router.replace("/app/today");
          return;
        }
        const m = await api.getMemoByDate(date);
        if (!alive) return;
        setMemo(m);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "메모를 불러오지 못했습니다.");
        setErrCode(e?.code);
      }
    })();
    return () => {
      alive = false;
    };
  }, [date, today, router]);

  if (errCode === "INSUFFICIENT_CREDIT") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">크래딧이 부족해요</h1>
        <p className="text-text-muted">
          지난 메모를 읽으려면 크래딧이 1 이상 필요해요. 오늘의 메모를 30자 이상
          작성하고 내일까지 이어가면 +20 크래딧이 적립됩니다.
        </p>
        <div>
          <Button onClick={() => router.push("/app/today")}>오늘 메모 쓰러 가기</Button>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
        {err}
      </div>
    );
  }
  if (!memo) {
    return <div className="text-sm text-text-muted">불러오는 중...</div>;
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{memo.dateKst}</h1>
        <span className="inline-flex items-center rounded-full bg-edge-blue-soft px-3 py-1 text-xs font-medium text-edge-blue">
          Readonly
        </span>
      </div>
      <article
        className="markdown-body rounded-md border border-border bg-bg-primary p-6"
        data-testid="memo-readonly"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{memo.body}</ReactMarkdown>
      </article>
    </div>
  );
}

export default function MemoByDatePage() {
  return (
    <Suspense fallback={<div className="text-sm text-text-muted">불러오는 중...</div>}>
      <MemoByDateInner />
    </Suspense>
  );
}
