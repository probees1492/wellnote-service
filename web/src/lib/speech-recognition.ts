// Web Speech API helpers + TypeScript declarations.
//
// The Web Speech API is non-standard and not present in lib.dom.d.ts.
// We declare minimal interfaces here so the rest of the app can use it safely.

export type RecognitionState = "idle" | "listening" | "unsupported" | "denied";

export interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

export interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((event: Event) => void) | null;
  onstart: ((event: Event) => void) | null;
  onnomatch: ((event: Event) => void) | null;
  onspeechend: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

/**
 * Returns true when the browser exposes any Web Speech recognition API.
 * Safe to call on the server (returns false).
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as SpeechWindow;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * Returns the available SpeechRecognition constructor, preferring the
 * standardized name. Returns null when unsupported.
 */
export function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Heuristic for Safari: continuous mode is unstable, so we recommend
 * single-utterance mode there.
 */
export function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
}

/**
 * Insert `insertion` into `source` at `cursor`. Adds a single space when
 * needed so that recognized phrases concatenate cleanly.
 */
export function insertAtCursor(
  source: string,
  cursor: number,
  insertion: string,
): { value: string; nextCursor: number } {
  const safeCursor = Math.max(0, Math.min(cursor, source.length));
  const before = source.slice(0, safeCursor);
  const after = source.slice(safeCursor);
  const needsLeadingSpace =
    before.length > 0 && !/\s$/.test(before) && !/^\s/.test(insertion);
  const glue = needsLeadingSpace ? " " : "";
  const merged = `${before}${glue}${insertion}${after}`;
  const nextCursor = safeCursor + glue.length + insertion.length;
  return { value: merged, nextCursor };
}
