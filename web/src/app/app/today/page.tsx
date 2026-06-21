"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "@phosphor-icons/react/dist/ssr";

import { DateHeading } from "@/components/editor/DateHeading";
import { HabitChain } from "@/components/editor/HabitChain";
import {
  ManuscriptEditor,
  type ManuscriptEditorHandle,
} from "@/components/editor/ManuscriptEditor";
import { SpeechToTextButton } from "@/components/editor/SpeechToTextButton";
import { WritingProgressBar } from "@/components/editor/WritingProgressBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  api,
  type ActivityGrid as GridT,
  type MemoWithBody,
  type StreakStatus,
} from "@/lib/api";
import { insertAtCursor } from "@/lib/speech-recognition";
import { todayKst } from "@/lib/time";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Picks a placeholder for the empty memo state based on the current KST hour.
 * Returns null on the server (renders deterministically until hydration).
 */
function useTimeOfDayPlaceholder(): string {
  return useMemo(() => {
    const now = new Date();
    const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
    const h = new Date(kstMs).getUTCHours();
    if (h >= 5 && h < 12) return "오늘 처음 떠오른 생각";
    if (h >= 12 && h < 18) return "지금 이 순간, 무엇이 보이나요?";
    if (h >= 18 && h < 23) return "오늘 마음에 남은 한 가지";
    return "내일의 나에게";
  }, []);
}

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
  const [streak, setStreak] = useState<StreakStatus | null>(null);
  const [grid, setGrid] = useState<GridT | null>(null);
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const latestBodyRef = useRef<string>("");
  const editorRef = useRef<ManuscriptEditorHandle | null>(null);
  const placeholder = useTimeOfDayPlaceholder();

  // Load today memo + streak + grid in parallel.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [m, s, g] = await Promise.all([
          api.todayMemo(),
          api.streakStatus().catch(() => null),
          api.activityGrid().catch(() => null),
        ]);
        if (!alive) return;
        setMemo(m);
        setBody(m.body ?? "");
        latestBodyRef.current = m.body ?? "";
        if (s) setStreak(s);
        if (g) setGrid(g);
        // Focus the editor on mount so the user can start typing immediately.
        requestAnimationFrame(() => editorRef.current?.focus());
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
    debounceRef.current = window.setTimeout(() => save(), 1000);
  }, [save]);

  function handleChange(v: string) {
    setBody(v);
    latestBodyRef.current = v;
    scheduleSave();
  }

  const handleTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim();
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
      if (textarea) {
        requestAnimationFrame(() => {
          try {
            textarea.focus();
            textarea.setSelectionRange(nextCursor, nextCursor);
          } catch {
            /* ignore */
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

  // Clear inline notices after 4s (STT) / 2s (milestone).
  useEffect(() => {
    if (!sttNotice) return;
    const id = window.setTimeout(() => setSttNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [sttNotice]);
  useEffect(() => {
    if (!milestoneToast) return;
    const id = window.setTimeout(() => setMilestoneToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [milestoneToast]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  // Opt-in sealing stamp triggers navigation to readonly view.
  const handleSealed = useCallback(() => {
    const finish = () => {
      if (memo?.dateKst) {
        router.replace(`/app/memo?date=${encodeURIComponent(memo.dateKst)}`);
      } else {
        router.replace(`/app/memo?date=${encodeURIComponent(today)}`);
      }
    };
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    save().finally(finish);
  }, [memo?.dateKst, router, save, today]);

  const handleCameraClick = useCallback(() => {
    setMilestoneToast("OCR은 곧 출시됩니다 📷");
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
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <DateHeading iso={today} />
          <div
            className="pt-1 text-sm text-muted-foreground"
            data-testid="save-state"
            data-state={saveState}
          >
            {saveLabel}
          </div>
        </div>
        <HabitChain streak={streak} grid={grid} />
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
      {milestoneToast ? (
        <div
          className="rounded-md border border-orange-400/40 bg-orange-50 px-3 py-2 text-sm text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
          data-testid="milestone-toast"
        >
          {milestoneToast}
        </div>
      ) : null}

      <Card className="border-0 bg-transparent shadow-none">
        <CardContent className="flex flex-col gap-3 p-0">
          <WritingProgressBar
            charCount={body.length}
            onMilestone={setMilestoneToast}
          />
          <div className="flex items-center justify-between gap-3 pt-1">
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
            <div className="flex items-center gap-2">
              <SpeechToTextButton
                onTranscript={handleTranscript}
                onInterim={handleInterim}
                onError={handleSttError}
                disabled={!memo}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCameraClick}
                disabled={!memo}
                title="사진에서 텍스트 가져오기 (곧 출시)"
                aria-label="OCR (곧 출시)"
                data-testid="ocr-button"
              >
                <Camera className="h-4 w-4" weight="duotone" aria-hidden />
              </Button>
            </div>
          </div>
          <ManuscriptEditor
            ref={editorRef}
            value={body}
            onChange={handleChange}
            onBlur={() => save()}
            onSealed={handleSealed}
            disabled={!memo}
            placeholder={memo ? placeholder : "메모를 불러오는 중..."}
            data-testid="memo-editor"
            data-ready={memo ? "true" : "false"}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end text-sm text-muted-foreground">
        <span data-testid="char-count">{body.length}자</span>
        <span className="mx-2">·</span>
        <span>1일 1메모</span>
      </div>
    </div>
  );
}
