/**
 * Supported UI locales. Order matters: shown in this order in the language
 * picker. Each entry carries both the BCP-47 tag and the native label so a
 * user who doesn't read the current UI language can still recognise their
 * own.
 */

export const LOCALES = [
  { code: "ko", native: "한국어", english: "Korean" },
  { code: "en", native: "English", english: "English" },
  { code: "ja", native: "日本語", english: "Japanese" },
  { code: "zh", native: "中文 (简体)", english: "Chinese (Simplified)" },
  { code: "la", native: "Latina", english: "Latin" },
  { code: "de", native: "Deutsch", english: "German" },
  { code: "fr", native: "Français", english: "French" },
  { code: "it", native: "Italiano", english: "Italian" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: LocaleCode = "ko";

const VALID = new Set<string>(LOCALES.map((l) => l.code));

export function isLocale(value: unknown): value is LocaleCode {
  return typeof value === "string" && VALID.has(value);
}

/** Resolve a best-effort browser locale to one we ship. */
export function detectBrowserLocale(): LocaleCode {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const candidates = [navigator.language, ...(navigator.languages ?? [])];
  for (const raw of candidates) {
    if (!raw) continue;
    // "zh-Hant-TW" → "zh"; "en-US" → "en"
    const base = raw.toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
