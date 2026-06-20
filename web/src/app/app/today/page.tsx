"use client";

import { useEffect, useRef, useState } from "react";
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
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "메모를 불러오지 못했습니다.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function save(force = false) {
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
    } catch (e: any) {
      setSaveState("error");
      setErr(e?.message ?? "저장 실패");
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-text-primary">{today}</h1>
        <div
          className="text-xs text-text-muted"
          data-testid="save-state"
          data-state={saveState}
        >
          {saveState === "saving"
            ? "저장 중..."
            : saveState === "saved"
            ? `저장됨 · ${savedAt ?? ""}`
            : saveState === "error"
            ? "저장 실패. 재시도"
            : "대기 중"}
        </div>
      </div>
      {err ? (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {err}
        </div>
      ) : null}
      <textarea
        value={body}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => save(true)}
        disabled={!memo}
        placeholder={
          memo
            ? "오늘 어떤 일이 있었나요? 마크다운으로 자유롭게 작성하세요."
            : "메모를 불러오는 중..."
        }
        className="editor-focus-edge min-h-[400px] w-full rounded-md border border-border bg-bg-primary p-4 text-base text-text-primary leading-relaxed focus:shadow-focus disabled:opacity-50"
        data-testid="memo-editor"
        data-ready={memo ? "true" : "false"}
      />
      <div className="flex items-center justify-end text-xs text-text-muted">
        <span data-testid="char-count">{body.length}자</span>
        <span className="mx-2">·</span>
        <span>최대 100,000자</span>
      </div>
    </div>
  );
}
