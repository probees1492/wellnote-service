"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CaretLeft,
  DotsThree,
  Globe,
  Lock,
  Plus,
  PushPin,
  Trash,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, type Memo, type Pin } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  PIN_COLOR_HEAD_CLASS,
  PIN_COLOR_LABEL,
  rotationForIndex,
} from "@/components/memo/pin-colors";
import { PinFormDialog } from "@/components/memo/PinFormDialog";

function PinsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pinId = params.get("id");

  if (pinId) {
    return <PinDetail pinId={pinId} onBack={() => router.push("/app/pins")} />;
  }
  return <PinsList />;
}

/* ------------------------------------------------------------------ */
/* List view — corkboard.                                              */
/* ------------------------------------------------------------------ */

function PinsList() {
  const [items, setItems] = useState<Pin[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await api.pins.list();
      setItems(r.items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "핀 목록을 불러오지 못했습니다.";
      setErr(msg);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <PushPin className="h-6 w-6" weight="duotone" aria-hidden />핀
        </h1>
        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
          data-testid="pin-create-button"
        >
          <Plus className="h-4 w-4" weight="bold" aria-hidden />새 핀
        </Button>
      </div>

      {err ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      ) : null}

      <div
        className="wn-corkboard min-h-[60vh] p-6"
        data-testid="pin-corkboard"
      >
        {items === null ? (
          <div className="text-sm text-muted-foreground">불러오는 중...</div>
        ) : items.length === 0 ? (
          <EmptyPins onCreate={() => setCreateOpen(true)} />
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((p, i) => (
              <PinCard key={p.id} pin={p} index={i} />
            ))}
          </div>
        )}
      </div>

      <PinFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="새 핀 만들기"
        description="이름은 1-40자."
        submitLabel="만들기"
        onSubmit={async (vals) => {
          await api.pins.create(vals);
          await load();
        }}
      />
    </div>
  );
}

function EmptyPins({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-12 text-center"
      data-testid="pin-empty"
    >
      <PushPin className="h-10 w-10 text-muted-foreground" weight="duotone" aria-hidden />
      <div className="text-base text-foreground/80">
        아직 핀이 없어요. 첫 핀을 만들어 노트를 분류해보세요.
      </div>
      <Button type="button" onClick={onCreate} data-testid="pin-empty-cta">
        <Plus className="h-4 w-4" weight="bold" aria-hidden />첫 핀 만들기
      </Button>
    </div>
  );
}

function PinCard({ pin, index }: { pin: Pin; index: number }) {
  const rotation = rotationForIndex(index);
  return (
    <Link
      href={`/app/pins?id=${pin.id}`}
      className="block focus:outline-none"
      data-testid={`pin-card-${pin.id}`}
    >
      <div
        className={cn(
          "wn-pin-card relative flex aspect-[5/4] flex-col items-center justify-center gap-2 p-4 text-center",
          rotation,
        )}
      >
        <span
          className={cn(
            "wn-pushpin absolute left-1/2 top-2 -translate-x-1/2",
            PIN_COLOR_HEAD_CLASS[pin.color],
          )}
          aria-label={PIN_COLOR_LABEL[pin.color]}
        />
        <div className="mt-3 line-clamp-2 font-serif text-lg font-semibold leading-tight text-foreground/90">
          {pin.name}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{pin.memoCount ?? 0}개 메모</span>
          <span aria-hidden>·</span>
          {pin.visibility === "public" ? (
            <Globe className="h-3.5 w-3.5" weight="duotone" aria-hidden />
          ) : (
            <Lock className="h-3.5 w-3.5" weight="duotone" aria-hidden />
          )}
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Detail view — single pin + its memos.                               */
/* ------------------------------------------------------------------ */

function PinDetail({ pinId, onBack }: { pinId: string; onBack: () => void }) {
  const router = useRouter();
  const [pin, setPin] = useState<Pin | null>(null);
  const [memos, setMemos] = useState<Memo[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [p, m] = await Promise.all([
        api.pins.get(pinId),
        api.pins.memos(pinId),
      ]);
      setPin(p);
      setMemos(m.items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "핀을 불러오지 못했습니다.";
      setErr(msg);
    }
  }, [pinId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await api.pins.delete(pinId);
      router.replace("/app/pins");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "삭제에 실패했습니다.";
      setErr(msg);
      setDeleting(false);
    }
  }, [pinId, router]);

  if (err) {
    return (
      <div className="flex flex-col gap-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="w-fit"
        >
          <CaretLeft className="h-4 w-4" weight="bold" aria-hidden />핀 목록
        </Button>
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      </div>
    );
  }

  if (!pin) {
    return (
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="w-fit"
        >
          <CaretLeft className="h-4 w-4" weight="bold" aria-hidden />핀 목록
        </Button>
        <div className="text-sm text-muted-foreground">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="w-fit"
        data-testid="pin-back"
      >
        <CaretLeft className="h-4 w-4" weight="bold" aria-hidden />핀 목록
      </Button>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn("wn-pushpin h-4 w-4", PIN_COLOR_HEAD_CLASS[pin.color])}
            aria-hidden
          />
          <h1
            className="font-serif text-3xl font-semibold tracking-tight"
            data-testid="pin-name"
          >
            {pin.name}
          </h1>
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
            {pin.visibility === "public" ? (
              <>
                <Globe className="h-3 w-3" weight="duotone" aria-hidden />공개
              </>
            ) : (
              <>
                <Lock className="h-3 w-3" weight="duotone" aria-hidden />비공개
              </>
            )}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="핀 메뉴"
              data-testid="pin-actions-trigger"
            >
              <DotsThree className="h-5 w-5" weight="bold" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              data-testid="pin-action-edit"
              onSelect={(e) => {
                e.preventDefault();
                setEditOpen(true);
              }}
            >
              수정
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="pin-action-delete"
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                setDeleteOpen(true);
              }}
            >
              <Trash className="h-4 w-4" weight="duotone" aria-hidden />삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="text-xs text-muted-foreground">
        {pin.memoCount ?? memos?.length ?? 0}개 메모
      </div>

      {memos === null ? (
        <div className="text-sm text-muted-foreground">불러오는 중...</div>
      ) : memos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground"
          data-testid="pin-detail-empty"
        >
          <PushPin className="h-8 w-8" weight="duotone" aria-hidden />
          <div>이 핀에 메모를 꽂아보세요</div>
          <div className="text-xs">
            메모 카드 우상단의 「⋯」 → 「핀에 꽂기」 에서 추가할 수 있어요.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-testid="pin-memo-list">
          {memos.map((m) => (
            <PinMemoRow key={m.id} memo={m} />
          ))}
        </div>
      )}

      <PinFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="핀 수정"
        submitLabel="저장"
        initial={{
          name: pin.name,
          color: pin.color,
          visibility: pin.visibility,
        }}
        onSubmit={async (vals) => {
          await api.pins.update(pinId, vals);
          await load();
        }}
      />

      <Dialog open={deleteOpen} onOpenChange={(v) => !deleting && setDeleteOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>핀 삭제</DialogTitle>
            <DialogDescription>
              이 핀을 삭제하시겠어요? 속한 메모는 사라지지 않고 핀 분류만
              해제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleting}
              data-testid="pin-delete-confirm"
            >
              {deleting ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PinMemoRow({ memo }: { memo: Memo }) {
  const href = `/app/memo?date=${encodeURIComponent(memo.dateKst)}`;
  const preview = useMemo(() => {
    const t = (memo.title ?? "").trim();
    if (t) return t.slice(0, 30);
    return "(제목 없음)";
  }, [memo.title]);
  return (
    <Link
      href={href}
      className="block rounded-md border bg-card p-3 transition hover:shadow-sm"
      data-testid={`pin-memo-${memo.id}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-medium">{preview}</div>
        <div className="text-xs text-muted-foreground">{memo.dateKst}</div>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {memo.charCount}자
      </div>
    </Link>
  );
}

export default function PinsPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">불러오는 중...</div>
      }
    >
      <PinsInner />
    </Suspense>
  );
}
