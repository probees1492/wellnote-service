/**
 * Manuscript editor user preferences, persisted to localStorage.
 *
 * All fields have safe defaults so first-run users get the "정통 200자"
 * (traditional Korean manuscript) experience without any opt-in needed.
 */

export type GridStyle = "manuscript" | "lines" | "dots";

export interface EditorPrefs {
  gridStyle: GridStyle;
  typewriter: boolean;
  firstLineIndent: boolean;
  inkCursor: boolean;
  penSound: boolean;
  sealCountdown: boolean;
}

export const DEFAULT_PREFS: EditorPrefs = {
  gridStyle: "manuscript",
  typewriter: false,
  firstLineIndent: true,
  inkCursor: true,
  penSound: false,
  sealCountdown: true,
};

const STORAGE_KEY = "wn:editorPrefs:v1";

export function loadEditorPrefs(): EditorPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<EditorPrefs>;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      // Validate enum to avoid stale/bad values
      gridStyle:
        parsed.gridStyle === "lines" ||
        parsed.gridStyle === "dots" ||
        parsed.gridStyle === "manuscript"
          ? parsed.gridStyle
          : DEFAULT_PREFS.gridStyle,
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
