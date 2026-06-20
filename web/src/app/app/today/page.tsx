"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SpeechToTextButton } from "@/components/editor/SpeechToTextButton";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api, type MemoWithBody } from "@/lib/api";
import { insertAtCursor } from "@/lib/speech-recognition";
import { todayKst } from "@/lib/time";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function TodayPage() {
  const today = todayKst();
  const [memo, setMemo] = useState<MemoWithBody | null>(null);
  const [body, setBody] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sttNotice, setSttNotice] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const latestBodyRef = useRef<string>("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  const save = useCallback(async () => {
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
  }, [memo]);

  const scheduleSave = useCallback(() => {
    setSaveState("saving");
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      save();
    }, 1000);
  }, [save]);

  function handleChange(v: string) {
    setBody(v);
    latestBodyRef.current = v;
    scheduleSave();
  }

  const handleTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const textarea = textareaRef.current;
      const current = latestBodyRef.current;
      const cursor = textarea
        ? (textarea.selectionStart ?? current.length)
        : current.length;
      const { value, nextCursor } = insertAtCursor(current, cursor, trimmed);
      latestBodyRef.current = value;
      setBody(value);
      // Move caret to the end of the just-inserted text after React commits.
      if (textarea) {
        requestAnimationFrame(() => {
          try {
            textarea.focus();
            textarea.setSelectionRange(nextCursor, nextCursor);
          } catch {
            // ignore
          }
        });
      }
      scheduleSave();
    },
    [scheduleSave],
  );

  const handleSttError = useCallback((message: string) => {
    setSttNotice(message);
  }, []);

  // Clear the STT inline notice after 4s.
  useEffect(() => {
    if (!sttNotice) return;
    const id = window.setTimeout(() => setSttNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [sttNotice]);

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
      {sttNotice ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          data-testid="stt-notice"
        >
          {sttNotice}
        </div>
      ) : null}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-end px-4 pt-3">
            <SpeechToTextButton
              onTranscript={handleTranscript}
              onError={handleSttError}
              disabled={!memo}
            />
          </div>
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => save()}
            disabled={!memo}
            placeholder={
              memo
                ? "오늘 어떤 일이 있었나요? 마크다운으로 자유롭게 작성하세요."
                : "메모를 불러오는 중..."
            }
            className="min-h-[420px] resize-y rounded-lg border-0 p-6 pt-3 font-serif text-base leading-loose focus-visible:ring-0 focus-visible:ring-offset-0"
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
