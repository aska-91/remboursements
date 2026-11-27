/**
 * Current UI text. All user-facing text lives in strings.en.ts / strings.fr.ts.
 * Always read `strings.x` at render time (never copy it into a module-level constant),
 * so a language change applies everywhere.
 */
import { getLang, setLang, LANGS, type Lang } from "../domain/locale";
import { en, type Strings } from "./strings.en";
import { fr } from "./strings.fr";

export type { Strings };
const BY_LANG: Record<Lang, Strings> = { en, fr };

export let strings: Strings = en;

const KEY = "refund-tracker-lang";

/** Saved choice, else the device language (French if it starts with "fr"), else English. */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (LANGS as string[]).includes(saved)) return saved as Lang;
  } catch {
    // storage unavailable: fall back to the device language
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

/** Switches UI text, amounts and new journal entries to `lang`, and remembers the choice. */
export function applyLang(lang: Lang, remember = true): void {
  setLang(lang);
  strings = BY_LANG[lang];
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    document.title = strings.appName;
  }
  if (remember) {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      // not critical: the choice just won't be remembered
    }
  }
}

export { getLang, LANGS, type Lang };
