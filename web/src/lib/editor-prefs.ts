/**
 * Editor user preferences, persisted to localStorage.
 *
 * Defaults follow the Atomic Habits "make it easy" rule: every decoration is
 * OFF by default so the user lands on a clean, distraction-free page.
 * Power users can opt back in to the legacy "정통 200자" experience from
 * Settings → 에디터 → 고급.
 */

export type GridStyle = "off" | "manuscript" | "lines" | "dots";

export interface EditorPrefs {
  gridStyle: GridStyle;
  typewriter: boolean;
  firstLineIndent: boolean;
  inkCursor: boolean;
  penSound: boolean;
  sealCountdown: boolean;
  /** Final-30s countdown + 封 stamp animation at KST midnight. Default OFF. */
  sealStamp: boolean;
  /** Optional warm "paper/parchment" background card tone. Default OFF. */
  paperTone: boolean;
}

export const DEFAULT_PREFS: EditorPrefs = {
  gridStyle: "off",
  typewriter: false,
  firstLineIndent: false,
  inkCursor: false,
  penSound: false,
  sealCountdown: false,
  sealStamp: false,
  paperTone: false,
};

const STORAGE_KEY = "wn:editorPrefs:v1";

export function loadEditorPrefs(): EditorPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<EditorPrefs>;
    const validGrid =
      parsed.gridStyle === "off" ||
      parsed.gridStyle === "lines" ||
      parsed.gridStyle === "dots" ||
      parsed.gridStyle === "manuscript"
        ? parsed.gridStyle
        : DEFAULT_PREFS.gridStyle;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      gridStyle: validGrid,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveEditorPrefs(prefs: EditorPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  // Notify subscribers in the same tab.
  try {
    window.dispatchEvent(new CustomEvent("wn:editorPrefsChanged"));
  } catch {
    /* ignore */
  }
}

/**
 * React-friendly subscription. Returns an unsubscribe fn.
 * Fires on cross-tab `storage` events and same-tab CustomEvent.
 */
export function subscribeEditorPrefs(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  const onCustom = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener("wn:editorPrefsChanged", onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("wn:editorPrefsChanged", onCustom);
  };
}
