"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ManuscriptEditor,
  type ManuscriptEditorHandle,
} from "@/components/editor/ManuscriptEditor";
import { SpeechToTextButton } from "@/components/editor/SpeechToTextButton";
import { Card, CardContent } from "@/components/ui/card";
import { api, type MemoWithBody } from "@/lib/api";
import { insertAtCursor } from "@/lib/speech-recognition";
import { todayKst } from "@/lib/time";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function TodayPage() {
  const today = todayKst();
  const router = useRouter();
  const [memo, setMemo] = useState<MemoWithBody | null>(null);
  const [body, setBody] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sttNotice, setSttNotice] = useState<string | null>(null);
  const [interim, setInterim] = useState<string>("");
  const debounceRef = useRef<number | null>(null);
  const latestBodyRef = useRef<string>("");
  const editorRef = useRef<ManuscriptEditorHandle | null>(null);

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
      // Final result arrived — clear the live interim preview.
      setInterim("");
      if (!trimmed) return;
      const textarea = editorRef.current?.textarea ?? null;
      const current = latestBodyRef.current;
      const cursor = textarea
        ? (textarea.selectionStart ?? current.length)
        : current.length;
      const { value, nextCursor } = insertAtCursor(current, cursor, trimmed + " ");
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

  const handleInterim = useCallback((text: string) => {
    setInterim(text);
  }, []);

  const handleSttError = useCallback((message: string) => {
    setSttNotice(message);
    setInterim("");
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

  // Once the page seals at KST midnight, force a save (best effort) and
  // navigate to the readonly view for today's now-sealed memo.
  const handleSealed = useCallback(() => {
    // Best-effort save then reload to /app/memo?date=...
    const finish = () => {
      const date = todayKst();
      // After midnight, "today" in KST is the next day — but the memo we
      // were just editing is the *previous* KST date. Use memo.dateKst if
      // available; fall back to navigating to /app which redirects.
      if (memo?.dateKst) {
        router.replace(`/app/memo?date=${encodeURIComponent(memo.dateKst)}`);
      } else {
        router.replace(`/app/memo?date=${encodeURIComponent(date)}`);
      }
    };
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    save().finally(finish);
  }, [memo?.dateKst, router, save]);

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
      <Card className="border-0 bg-transparent shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-1">
            {interim ? (
              <span
                className="flex-1 truncate font-serif text-sm italic text-muted-foreground"
                data-testid="stt-interim"
              >
                {interim}
              </span>
            ) : (
              <span className="flex-1" />
            )}
            <SpeechToTextButton
              onTranscript={handleTranscript}
              onInterim={handleInterim}
              onError={handleSttError}
              disabled={!memo}
            />
          </div>
          <ManuscriptEditor
            ref={editorRef}
            value={body}
            onChange={handleChange}
            onBlur={() => save()}
            onSealed={handleSealed}
            disabled={!memo}
            placeholder={
              memo
                ? "오늘 어떤 일이 있었나요? 한 칸씩 정성껏 적어 보세요."
                : "메모를 불러오는 중..."
            }
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
