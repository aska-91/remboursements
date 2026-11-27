import type { Cents } from "./types";

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });

/** Euros (possibly fractional, possibly a string with "," or ".") → integer cents. */
export function toCents(euros: number | string): Cents {
  const n = typeof euros === "string" ? Number(euros.trim().replace(",", ".")) : euros;
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function toEuros(c: Cents): number {
  return c / 100;
}

/** 1250 → "€12.50" */
export function formatMoney(c: Cents): string {
  return eur.format(c / 100);
}
