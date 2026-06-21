/**
 * Editor user preferences, persisted to localStorage.
 *
 * Defaults turn ON every advanced decoration so the editor lands on a
 * full "calligraphic journal" experience out of the box. Users can dial
 * any of them off from Settings → 에디터 — 고급.
 */

export type GridStyle = "off" | "manuscript" | "lines" | "dots";

export interface EditorPrefs {
  gridStyle: GridStyle;
  typewriter: boolean;
  firstLineIndent: boolean;
  inkCursor: boolean;
  penSound: boolean;
  sealCountdown: boolean;
  /** Final-30s countdown + 封 stamp animation at KST midnight. */
  sealStamp: boolean;
  /** Optional warm "paper/parchment" background card tone. */
  paperTone: boolean;
}

export const DEFAULT_PREFS: EditorPrefs = {
  gridStyle: "lines",
  typewriter: true,
  firstLineIndent: true,
  inkCursor: true,
  penSound: true,
  sealCountdown: true,
  sealStamp: true,
  paperTone: true,
};

// `v2` bump forces a one-time reset to the new "everything on" defaults
// for users who had the previous "everything off" v1 prefs in storage.
const STORAGE_KEY = "wn:editorPrefs:v2";

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
