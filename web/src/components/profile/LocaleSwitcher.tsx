"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LOCALES, type LocaleCode } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

/**
 * Grid of toggle buttons — one per supported locale. Switching mutates the
 * provider immediately so labels update across the whole app on click.
 */
export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      role="radiogroup"
      data-testid="locale-switcher"
      aria-label="Language"
    >
      {LOCALES.map((l) => {
        const active = l.code === locale;
        return (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setLocale(l.code as LocaleCode)}
            data-testid={`locale-${l.code}`}
            className={cn(
              "flex flex-col items-start rounded-md border px-3 py-2 text-left text-sm transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent",
            )}
          >
            <span className="font-medium">{l.native}</span>
            <span
              className={cn(
                "text-xs",
                active ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {l.english}
            </span>
          </button>
        );
      })}
    </div>
  );
}
