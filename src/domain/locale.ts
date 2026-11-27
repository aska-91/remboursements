/**
 * Current language for formatted amounts and new journal entries.
 * The UI sets it; it defaults to English (tests rely on that).
 */
export type Lang = "en" | "fr";
export const LANGS: readonly Lang[] = ["en", "fr"];

let current: Lang = "en";

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
}
