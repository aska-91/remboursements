import type { Category, Claim, ClaimStatus, Ymd } from "./types";
import { claimStatus, nextDue } from "./status";

export const LIST_FILTERS = ["in_progress", "to_chase", "done", "refused_cancelled", "archived", "all"] as const;
export type ListFilter = (typeof LIST_FILTERS)[number];

/** Urgency order used for sorting. */
export const STATUS_PRIORITY: Record<ClaimStatus, number> = {
  late: 0, gap: 1, to_return: 2, to_send: 3, partial: 4, pending: 5, received: 6, refused: 7, cancelled: 8,
};

export function matchesFilter(c: Claim, f: ListFilter, today: Ymd): boolean {
  if (f === "all") return true;
  if (f === "archived") return c.archived;
  if (c.archived) return false;
  const s = claimStatus(c, today);
  switch (f) {
    case "in_progress": return s !== "received" && s !== "refused" && s !== "cancelled";
    case "to_chase": return s === "late" || s === "gap";
    case "done": return s === "received";
    case "refused_cancelled": return s === "refused" || s === "cancelled";
  }
}

/** Free-text search over label, notes, reference, tracking number and journal. */
export function matchesSearch(c: Claim, query: string, categoryLabel = ""): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [c.label, c.notes, c.ref, categoryLabel, c.store, c.subcategory, c.tracking, ...c.log.map((l) => l.text)].join(" ").toLowerCase();
  return hay.includes(q);
}

export interface ListQuery {
  filter: ListFilter;
  search: string;
  category: Category | "all";
  /** Display name of each category, so searching "pharmacy" finds pharmacy claims. */
  categoryLabel?: (c: Category) => string;
}

/** Urgent first; open claims by next due date, closed ones by most recent date. */
export function compareClaims(a: Claim, b: Claim, today: Ymd): number {
  const pa = STATUS_PRIORITY[claimStatus(a, today)];
  const pb = STATUS_PRIORITY[claimStatus(b, today)];
  if (pa !== pb) return pa - pb;
  if (pa >= STATUS_PRIORITY.received) return b.date.localeCompare(a.date);
  return nextDue(a, today).localeCompare(nextDue(b, today));
}

export function listClaims(claims: Claim[], q: ListQuery, today: Ymd): Claim[] {
  return claims
    .filter((c) =>
      matchesFilter(c, q.filter, today) &&
      (q.category === "all" || c.category === q.category) &&
      matchesSearch(c, q.search, q.categoryLabel?.(c.category)))
    .sort((a, b) => compareClaims(a, b, today));
}
