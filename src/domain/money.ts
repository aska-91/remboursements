import type { Cents } from "./types";
import { getLang } from "./locale";

const formats = {
  en: new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }),
  fr: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }),
};

/** Euros (possibly fractional, possibly a string with "," or ".") → integer cents. */
export function toCents(euros: number | string): Cents {
  const n = typeof euros === "string" ? Number(euros.trim().replace(",", ".")) : euros;
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function toEuros(c: Cents): number {
  return c / 100;
}

/** 1250 → "€12.50" in English, "12,50 €" in French. */
export function formatMoney(c: Cents): string {
  // Normalise the narrow/no-break spaces Intl uses in French, so text stays searchable.
  return formats[getLang()].format(c / 100).replace(/[  ]/g, " ");
}
