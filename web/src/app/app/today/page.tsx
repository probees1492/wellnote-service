"use client";

import { useEffect, useRef, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api, type MemoWithBody } from "@/lib/api";
import { todayKst } from "@/lib/time";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function TodayPage() {
  const today = todayKst();
  const [memo, setMemo] = useState<MemoWithBody | null>(null);
  const [body, setBody] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const latestBodyRef = useRef<string>("");

  // Load today memo
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = await api.todayMemo();
        if (!alive) return;
        setMemo(m);
        setBody(m.body ?? "");
        latestBodyRef.current = m.body ?? "";
      } catch (e: unknown) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "메모를 불러오지 못했습니다.";
        setErr(msg);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    if (!memo) return;
    setSaveState("saving");
    try {
      const updated = await api.patchMemo(memo.id, latestBodyRef.current);
      setMemo(updated);
      const t = new Date();
      const hh = String(t.getHours()).padStart(2, "0");
      const mm = String(t.getMinutes()).padStart(2, "0");
      setSavedAt(`${hh}:${mm}`);
      setSaveState("saved");
    } catch (e: unknown) {
      setSaveState("error");
      const msg = e instanceof Error ? e.message : "저장 실패";
      setErr(msg);
    }
  }

  function handleChange(v: string) {
    setBody(v);
    latestBodyRef.current = v;
    setSaveState("saving");
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      save();
    }, 1000);
  }

  // Force-save on blur and unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const saveLabel =
    saveState === "saving"
      ? "저장 중..."
      : saveState === "saved"
        ? `저장됨 · ${savedAt ?? ""}`
        : saveState === "error"
          ? "저장 실패. 재시도"
          : "대기 중";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{today}</h1>
        <div
          className="text-sm text-muted-foreground"
          data-testid="save-state"
          data-state={saveState}
        >
          {saveLabel}
        </div>
      </div>
      {err ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      ) : null}
      <Card>
        <CardContent className="p-0">
          <Textarea
            value={body}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => save()}
            disabled={!memo}
            placeholder={
              memo
                ? "오늘 어떤 일이 있었나요? 마크다운으로 자유롭게 작성하세요."
                : "메모를 불러오는 중..."
            }
            className="min-h-[420px] resize-y rounded-lg border-0 p-6 font-serif text-base leading-loose focus-visible:ring-0 focus-visible:ring-offset-0"
            data-testid="memo-editor"
            data-ready={memo ? "true" : "false"}
          />
        </CardContent>
      </Card>
      <div className="flex items-center justify-end text-sm text-muted-foreground">
        <span data-testid="char-count">{body.length}자</span>
        <span className="mx-2">·</span>
        <span>최대 100,000자</span>
      </div>
    </div>
  );
}
