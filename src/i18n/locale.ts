export type Locale = "en" | "vi";

export const LOCALE_STORAGE_KEY = "enablecode.locale";

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "vi";
}

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}
