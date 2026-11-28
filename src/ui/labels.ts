import type { Claim } from "../domain/types";
import { groupOf } from "../domain/types";
import { strings } from "./strings";

/**
 * What kind of expense this is, in words: the type of care for health,
 * the store for shopping, otherwise "Other"; plus the optional sub-category.
 */
export function kindLabel(c: Claim): string {
  const g = groupOf(c.category);
  const main = g === "health" ? strings.categories[c.category] : g === "shopping" ? c.store.trim() || strings.noStore : strings.groups.other;
  return c.subcategory.trim() ? `${main} · ${c.subcategory.trim()}` : main;
}

/** "Type / Store" column of the history: type of care, store, or "Other". */
export function typeOrStore(c: Claim): string {
  const g = groupOf(c.category);
  return g === "health" ? strings.categories[c.category] : g === "shopping" ? c.store.trim() || strings.noStore : strings.groups.other;
}
