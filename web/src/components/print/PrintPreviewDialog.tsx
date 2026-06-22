"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_PRINT_OPTIONS,
  type PrintOptions,
  loadPrintOptions,
  savePrintOptions,
} from "@/lib/print-options";

import { PrintableMemo } from "./PrintableMemo";

interface PrintPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateKst: string;
  body: string;
  displayName?: string | null;
  readonlyAt?: string | null;
}

/**
 * Tier-1 print preview: lets the user pick which extras (header / seal time
 * / manuscript grid / watermark / page numbers) ship to the printer.
 * Live mock-up updates as they toggle. On 인쇄 click, the print target is
 * mounted to <body> via a portal so the @media print rules can show ONLY
 * that element while hiding the rest of the app shell.
 */
export function PrintPreviewDialog({
  open,
  onOpenChange,
  dateKst,
  body,
  displayName,
  readonlyAt,
}: PrintPreviewDialogProps) {
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS);
  const [printing, setPrinting] = useState(false);

  // Hydrate from localStorage on first open.
  useEffect(() => {
    if (!open) return;
    setOptions(loadPrintOptions());
  }, [open]);

  function toggle(key: keyof PrintOptions, value: boolean) {
    setOptions((prev) => {
      const next = { ...prev, [key]: value };
      savePrintOptions(next);
      return next;
    });
  }

  function handlePrint() {
    setPrinting(true);
    // Defer to next tick so the portal-mounted print target paints with
    // the current options before window.print() snapshots the document.
    requestAnimationFrame(() => {
      window.print();
      // Tear down right after the print dialog closes — the browser
      // resolves window.print() synchronously after the dialog is dismissed.
      setPrinting(false);
      onOpenChange(false);
    });
  }

  // Portal target: print-only copy of the memo, mounted directly under
  // <body> so the @media print rules (`body > [data-print-root] {...}`)
  // can show only it. Always rendered while the dialog is open so the
  // browser can snapshot it without a re-render race.
  const printTarget = useMemo(() => {
    if (typeof document === "undefined") return null;
    return (
      <div data-print-root className="wn-print-root">
        <PrintableMemo
          dateKst={dateKst}
          body={body}
          displayName={displayName}
          readonlyAt={readonlyAt}
          options={options}
        />
      </div>
    );
  }, [dateKst, body, displayName, readonlyAt, options]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>인쇄 미리보기</DialogTitle>
            <DialogDescription>
              아래 옵션을 켜고 끄며 출력 결과를 확인한 뒤 인쇄하세요. (PDF
              저장도 같은 다이얼로그에서 가능합니다.)
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
            {/* Toggles */}
            <div className="flex flex-col gap-3 text-sm">
              <PrintToggle
                id="po-header"
                label="날짜 · 필명 헤더"
                checked={options.header}
                onCheckedChange={(v) => toggle("header", v)}
              />
              <PrintToggle
                id="po-seal"
                label="봉인 시각"
                checked={options.sealTime}
                onCheckedChange={(v) => toggle("sealTime", v)}
                hint={readonlyAt ? undefined : "이 메모는 아직 미봉인"}
              />
              <PrintToggle
                id="po-grid"
                label="원고지 격자"
                checked={options.grid}
                onCheckedChange={(v) => toggle("grid", v)}
              />
              <PrintToggle
                id="po-watermark"
                label="워터마크 (wellnote.io)"
                checked={options.watermark}
                onCheckedChange={(v) => toggle("watermark", v)}
              />
              <PrintToggle
                id="po-pagenum"
                label="페이지 번호"
                checked={options.pageNumber}
                onCheckedChange={(v) => toggle("pageNumber", v)}
              />
            </div>

            {/* Live preview */}
            <div className="flex max-h-[60vh] items-start justify-center overflow-auto rounded-md bg-muted/40 p-4">
              <PrintableMemo
                dateKst={dateKst}
                body={body}
                displayName={displayName}
                readonlyAt={readonlyAt}
                options={options}
                preview
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={printing}
            >
              취소
            </Button>
            <Button
              onClick={handlePrint}
              disabled={printing}
              data-testid="print-confirm"
            >
              인쇄
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Body-level portal — the actual print target. Only mounted while
          the dialog is open so we don't keep an extra DOM tree around when
          the user isn't about to print. */}
      {open && typeof document !== "undefined"
        ? createPortal(printTarget, document.body)
        : null}
    </>
  );
}

function PrintToggle({
  id,
  label,
  checked,
  onCheckedChange,
  hint,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <Label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-md border bg-card/40 px-3 py-2"
    >
      <span className="flex flex-col">
        <span>{label}</span>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
    </Label>
  );
}
