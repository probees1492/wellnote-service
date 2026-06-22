"use client";

/**
 * User-tweakable knobs for the print preview dialog. Sticky in localStorage
 * so a user who toggled, e.g., grid off once doesn't have to do it every
 * time. Defaults aim for a document-looking artefact: date header, signed
 * pen name, lower-right watermark, page numbers. Manuscript grid is off by
 * default (extra ink, can feel busy on small printers).
 */
export interface PrintOptions {
  /** 날짜 + 필명 헤더 */
  header: boolean;
  /** 봉인 시각 (메모가 readonly일 때만 의미 있음) */
  sealTime: boolean;
  /** 원고지 격자 출력 */
  grid: boolean;
  /** 우하단 "wellnote.io" 워터마크 */
  watermark: boolean;
  /** 페이지 번호 (다중 페이지 시) */
  pageNumber: boolean;
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  header: true,
  sealTime: true,
  grid: false,
  watermark: true,
  pageNumber: true,
};

const KEY = "wn:printOptions";

export function loadPrintOptions(): PrintOptions {
  if (typeof window === "undefined") return DEFAULT_PRINT_OPTIONS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PRINT_OPTIONS;
    const parsed = JSON.parse(raw) as Partial<PrintOptions>;
    return { ...DEFAULT_PRINT_OPTIONS, ...parsed };
  } catch {
    return DEFAULT_PRINT_OPTIONS;
  }
}

export function savePrintOptions(opts: PrintOptions): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(opts));
  } catch {
    /* ignore */
  }
}
