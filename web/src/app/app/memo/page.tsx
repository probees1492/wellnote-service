"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { DateHeading } from "@/components/editor/DateHeading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, type MemoWithBody } from "@/lib/api";
import { loadEditorPrefs } from "@/lib/editor-prefs";
import { todayKst } from "@/lib/time";
import { cn } from "@/lib/utils";

function MemoByDateInner() {
  const params = useSearchParams();
  const date = params.get("date") ?? "";
  const router = useRouter();
  const today = todayKst();
  const [memo, setMemo] = useState<MemoWithBody | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<string | undefined>(undefined);
  const [gridStyle, setGridStyle] = useState<string>("manuscript");
  const [firstLineIndent, setFirstLineIndent] = useState<boolean>(true);

  useEffect(() => {
    const prefs = loadEditorPrefs();
    setGridStyle(prefs.gridStyle);
    setFirstLineIndent(prefs.firstLineIndent);
  }, []);

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
      } catch (e: unknown) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "메모를 불러오지 못했습니다.";
        const code = (e as { code?: string })?.code;
        setErr(msg);
        setErrCode(code);
      }
    })();
    return () => {
      alive = false;
    };
  }, [date, today, router]);

  if (errCode === "INSUFFICIENT_CREDIT") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          크래딧이 부족해요
        </h1>
        <p className="text-muted-foreground">
          지난 메모를 읽으려면 크래딧이 1 이상 필요해요. 오늘의 메모를 30자 이상
          작성하고 내일까지 이어가면 +20 크래딧이 적립됩니다.
        </p>
        <div>
          <Button onClick={() => router.push("/app/today")}>
            오늘 메모 쓰러 가기
          </Button>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {err}
      </div>
    );
  }
  if (!memo) {
    return <div className="text-sm text-muted-foreground">불러오는 중...</div>;
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <DateHeading iso={memo.dateKst} />
        <Badge variant="secondary" className="mt-1">Readonly</Badge>
      </div>
      <Card className="border-0 bg-transparent shadow-none">
        <CardContent
          className={cn(
            "wn-paper wn-paper-readonly p-6",
            gridStyle === "lines"
              ? "wn-paper-lines"
              : gridStyle === "dots"
                ? "wn-paper-dots"
                : "wn-paper-manuscript",
          )}
        >
          <article
            className={cn(
              "markdown-body font-serif text-base leading-[2rem] tracking-[0.02em]",
              firstLineIndent && "wn-first-line-indent",
            )}
            data-testid="memo-readonly"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{memo.body}</ReactMarkdown>
          </article>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MemoByDatePage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">불러오는 중...</div>
      }
    >
      <MemoByDateInner />
    </Suspense>
  );
}
