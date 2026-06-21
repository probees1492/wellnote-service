"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_LOCALE,
  detectBrowserLocale,
  isLocale,
  type LocaleCode,
} from "./locales";

// All messages are bundled — small JSON keeps the bundle tiny vs. dynamic
// imports + the static export target rules out runtime locale files anyway.
import deMsgs from "@/messages/de.json";
import enMsgs from "@/messages/en.json";
import frMsgs from "@/messages/fr.json";
import itMsgs from "@/messages/it.json";
import jaMsgs from "@/messages/ja.json";
import koMsgs from "@/messages/ko.json";
import laMsgs from "@/messages/la.json";
import zhMsgs from "@/messages/zh.json";

type Messages = Record<string, string>;

const BUNDLES: Record<LocaleCode, Messages> = {
  ko: koMsgs as Messages,
  en: enMsgs as Messages,
  ja: jaMsgs as Messages,
  zh: zhMsgs as Messages,
  la: laMsgs as Messages,
  de: deMsgs as Messages,
  fr: frMsgs as Messages,
  it: itMsgs as Messages,
};

const STORAGE_KEY = "wn:locale";

interface LocaleContextValue {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Wrap the app shell. Hydrates the active locale from localStorage on mount
 * (falling back to the browser's preferred language). Switching the locale
 * persists and updates `<html lang>` so screen readers + Intl APIs follow.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let next: LocaleCode = DEFAULT_LOCALE;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) next = stored;
      else next = detectBrowserLocale();
    } catch {
      next = detectBrowserLocale();
    }
    setLocaleState(next);
    if (document?.documentElement) {
      document.documentElement.lang = next;
    }
  }, []);

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    if (document?.documentElement) {
      document.documentElement.lang = next;
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const bundle = BUNDLES[locale] ?? BUNDLES[DEFAULT_LOCALE];
      const template = bundle[key] ?? BUNDLES[DEFAULT_LOCALE][key] ?? key;
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (_, name) =>
        params[name] !== undefined ? String(params[name]) : `{${name}}`,
      );
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Fallback: render-time identity translation. This shouldn't happen in
    // practice because LocaleProvider wraps the entire app, but we keep
    // unit tests / Storybook robust.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => undefined,
      t: (k) => BUNDLES[DEFAULT_LOCALE][k] ?? k,
    };
  }
  return ctx;
}

/** Short-hand hook for components that only need the translator. */
export function useT() {
  return useLocale().t;
}
