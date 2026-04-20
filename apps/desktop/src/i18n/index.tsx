import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MESSAGES, PHRASE_TO_KEY } from "./messages";
import { STORAGE_KEY, type AppLocale } from "./types";

let currentLocale: AppLocale = "ko";
const localeWatchers = new Set<(locale: AppLocale) => void>();
const KO_VALUE_TO_KEY: Record<string, string> = Object.entries(MESSAGES.ko).reduce<Record<string, string>>(
  (acc, [key, value]) => {
    if (!(value in acc)) {
      acc[value] = key;
    }
    return acc;
  },
  {},
);

function renderTemplate(input: string, vars?: Record<string, string | number>): string {
  if (!vars) {
    return input;
  }
  return input.replace(/\{(\w+)\}/g, (_, key: string) => {
    const row = vars[key];
    return row == null ? "" : String(row);
  });
}

export function getCurrentLocale(): AppLocale {
  return currentLocale;
}

export function setCurrentLocale(locale: AppLocale) {
  currentLocale = locale;
  for (const watcher of localeWatchers) {
    watcher(locale);
  }
}

export function onLocaleChange(watcher: (locale: AppLocale) => void): () => void {
  localeWatchers.add(watcher);
  return () => {
    localeWatchers.delete(watcher);
  };
}

export function t(key: string, vars?: Record<string, string | number>, locale = currentLocale): string {
  const dict = MESSAGES[locale] ?? MESSAGES.ko;
  const base =
    locale === "ko"
      ? dict[key] ?? MESSAGES.en[key] ?? key
      : dict[key] ?? MESSAGES.en[key] ?? key;
  return renderTemplate(base, vars);
}

export function tp(phraseKo: string, vars?: Record<string, string | number>, locale = currentLocale): string {
  if (locale === "ko") {
    return renderTemplate(phraseKo, vars);
  }
  const points = phraseKo.match(/^(\d+)점$/);
  if (points) {
    return `${points[1]} pts`;
  }
  const count = phraseKo.match(/^(\d+)개$/);
  if (count) {
    return `${count[1]} items`;
  }
  const key = PHRASE_TO_KEY[phraseKo] ?? KO_VALUE_TO_KEY[phraseKo];
  if (!key) {
    return renderTemplate(phraseKo, vars);
  }
  return t(key, vars, locale);
}

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  cycleLocale: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tp: (phraseKo: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue>({
  locale: "ko",
  setLocale: () => {},
  cycleLocale: () => {},
  t: (key, vars) => t(key, vars, "ko"),
  tp: (phrase, vars) => renderTemplate(phrase, vars),
});

const LOCALE_ORDER: AppLocale[] = ["ko", "en"];

function normalizeLocale(input: unknown): AppLocale {
  if (input === "ko" || input === "en") {
    return input;
  }
  return "ko";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("ko");

  useEffect(() => {
    setCurrentLocale(locale);
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.setAttribute("data-locale", locale);
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        const normalized = normalizeLocale(next);
        setCurrentLocale(normalized);
        setLocaleState(normalized);
      },
      cycleLocale: () => {
        setLocaleState((prev) => {
          const next = LOCALE_ORDER[(LOCALE_ORDER.indexOf(prev) + 1) % LOCALE_ORDER.length];
          setCurrentLocale(next);
          return next;
        });
      },
      t: (key, vars) => t(key, vars, locale),
      tp: (phrase, vars) => tp(phrase, vars, locale),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export function localeShortLabel(locale: AppLocale): string {
  if (locale === "ko") {
    return "KO";
  }
  return "EN";
}

export type { AppLocale } from "./types";
