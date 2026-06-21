"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { BuddyAvatar } from "@/components/buddies/BuddyAvatar";
import { CommentSection } from "@/components/buddies/CommentSection";
import { ReactionBar } from "@/components/buddies/ReactionBar";
import { DateHeading } from "@/components/editor/DateHeading";
import { MemoActionsMenu } from "@/components/memo/MemoActionsMenu";
import { TtsControls } from "@/components/editor/TtsControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, type MemoWithBody } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { loadEditorPrefs } from "@/lib/editor-prefs";
import { todayKst } from "@/lib/time";
import { cn } from "@/lib/utils";

const PIN_COLOR_DOT: Record<string, string> = {
  slate: "bg-slate-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
};

interface BuddyMemoMeta {
  ownerId: string;
  ownerDisplayName: string;
  ownerAvatarUrl: string | null;
  pin: { id: string; name: string; color: string } | null;
}

function MemoViewerInner() {
  const params = useSearchParams();
  const memoId = params.get("id") ?? "";
  const date = params.get("date") ?? "";
  const router = useRouter();
  const today = todayKst();
  const me = useAuth((s) => s.user);
  const [memo, setMemo] = useState<MemoWithBody | null>(null);
  const [buddyMeta, setBuddyMeta] = useState<BuddyMemoMeta | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<string | undefined>(undefined);
  const [gridStyle, setGridStyle] = useState<string>("manuscript");
  const [firstLineIndent, setFirstLineIndent] = useState<boolean>(true);

  useEffect(() => {
    const prefs = loadEditorPrefs();
    setGridStyle(prefs.gridStyle);
    setFirstLineIndent(prefs.firstLineIndent);
  }, []);

  // Loader: prefer ?id= (buddy/memo direct lookup), fall back to ?date=.
  useEffect(() => {
    let alive = true;
    setErr(null);
    setErrCode(undefined);
    setMemo(null);
    setBuddyMeta(null);

    if (memoId) {
      (async () => {
        try {
          const r = await api.buddies.memo(memoId);
          if (!alive) return;
          setMemo(r.memo);
          // Hydrate buddy meta only when the viewer isn't the owner; for own
          // memos we still want the normal pin-attach UX.
          if (me && r.owner.id !== me.id) {
            // We need owner displayName + avatar; fetch the buddy profile.
            let ownerDisplayName = "버디";
            let ownerAvatarUrl: string | null = null;
            try {
              const b = await api.buddies.get(r.owner.id);
              if (alive) {
                ownerDisplayName = b.buddy.displayName;
                ownerAvatarUrl = b.buddy.avatarUrl;
              }
            } catch {
              /* fall back to generic label */
            }
            if (!alive) return;
            setBuddyMeta({
              ownerId: r.owner.id,
              ownerDisplayName,
              ownerAvatarUrl,
              pin: r.pin
                ? { id: r.pin.id, name: r.pin.name, color: r.pin.color }
                : null,
            });
          } else {
            setBuddyMeta(null);
          }
        } catch (e: unknown) {
          if (!alive) return;
          const msg = e instanceof Error ? e.message : "메모를 불러오지 못했어요.";
          const code = (e as { code?: string })?.code;
          setErr(msg);
          setErrCode(code);
        }
      })();
      return () => {
        alive = false;
      };
    }

    // Legacy ?date= flow — unchanged.
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
  }, [memoId, date, today, router, me]);

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

  // Determine ownership context: a memo from `?id=` may be a buddy's, or your
  // own. Buddy meta is set only when memo.userId !== me.id.
  const isBuddyMemo = !!buddyMeta;
  const ownerId = buddyMeta?.ownerId ?? memo.userId;
  // Reactions + comments are available when reading a buddy memo (always) or
  // when reading your own via ?id (owner can interact with their memo).
  const interactionsAvailable = !!memoId;

  return (
    <div className="flex flex-col gap-4">
      {isBuddyMemo && buddyMeta ? (
        <div
          className="flex items-center gap-3 rounded-md border bg-card p-3"
          data-testid="memo-owner-header"
        >
          <BuddyAvatar
            displayName={buddyMeta.ownerDisplayName}
            avatarUrl={buddyMeta.ownerAvatarUrl}
            sizeClass="h-10 w-10"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">
              {buddyMeta.ownerDisplayName}
            </span>
            <span className="text-xs text-muted-foreground">
              {memo.dateKst}
              {buddyMeta.pin ? (
                <>
                  <span className="px-1.5">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        PIN_COLOR_DOT[buddyMeta.pin.color] ?? "bg-slate-500",
                      )}
                      aria-hidden
                    />
                    {buddyMeta.pin.name}
                  </span>
                </>
              ) : null}
            </span>
          </div>
          <Badge variant="secondary">Readonly</Badge>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <DateHeading iso={memo.dateKst} />
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">Readonly</Badge>
            <MemoActionsMenu
              memoId={memo.id}
              pinId={memo.pinId ?? null}
              onPinChanged={(next) =>
                setMemo((prev) => (prev ? { ...prev, pinId: next } : prev))
              }
            />
          </div>
        </div>
      )}

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

      <TtsControls text={memo.body} />

      {interactionsAvailable ? (
        <div className="flex flex-col gap-4" data-testid="memo-interactions">
          <ReactionBar memoId={memo.id} />
          <CommentSection memoId={memo.id} ownerId={ownerId} />
        </div>
      ) : null}
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
      <MemoViewerInner />
    </Suspense>
  );
}
