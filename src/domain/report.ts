/**
 * History reports: which expenses of a family / type / store fall in a period,
 * what was paid upfront, what came back and what it really cost.
 */
import type { Category, Claim, Group, Ymd } from "./types";
import { GROUPS, HEALTH_CATEGORIES, groupOf } from "./types";
import { addMonths, addYears, endOfMonth, startOfMonth } from "./dates";
import { claimReceived, claimRemaining, claimStatus } from "./status";

/** "Decathlon", "decathlon " and "DÉCATHLON" are the same store. */
export function normKey(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export interface Totals {
  count: number;
  advanced: number;
  received: number;
  /** Still expected (pending, late, gaps). */
  remaining: number;
  /** Real cost = advanced − received − remaining (as everywhere in the app). */
  outOfPocket: number;
}

export function totalsOf(claims: Claim[], today: Ymd): Totals {
  let advanced = 0, received = 0, remaining = 0;
  for (const c of claims) {
    advanced += c.amount;
    received += claimReceived(c);
    remaining += claimRemaining(c, today);
  }
  return { count: claims.length, advanced, received, remaining, outOfPocket: advanced - received - remaining };
}

export interface ReportFilter {
  group: Group | "all";
  /** Health sub-category (only used when group is "health"). */
  category: Category | "all";
  /** Store key from `normKey` ("" = expenses without a store); only for shopping. */
  store: string | "all";
  /** Sub-category key from `normKey` ("" = none); only for shopping and other. */
  subcategory: string | "all";
  /** Inclusive bounds on the expense date; "" = no bound. */
  from: Ymd;
  to: Ymd;
}

export const ALL_FILTER: ReportFilter = { group: "all", category: "all", store: "all", subcategory: "all", from: "", to: "" };

/** Cancelled expenses are not expenses any more: they are left out, as in the totals. */
export function reportClaims(claims: Claim[], f: ReportFilter): Claim[] {
  return claims.filter((c) => {
    if (c.cancelled) return false;
    const g = groupOf(c.category);
    if (f.group !== "all" && g !== f.group) return false;
    if (f.group === "health" && f.category !== "all" && c.category !== f.category) return false;
    if (f.group === "shopping" && f.store !== "all" && normKey(c.store) !== f.store) return false;
    if ((f.group === "shopping" || f.group === "other") && f.subcategory !== "all" && normKey(c.subcategory) !== f.subcategory) return false;
    if (f.from && c.date < f.from) return false;
    if (f.to && c.date > f.to) return false;
    return true;
  });
}

export interface Choice {
  key: string;
  /** Display spelling: the one used by the most recently modified expense. */
  label: string;
  count: number;
}

function choices(values: { text: string; mod: number }[]): Choice[] {
  const map = new Map<string, Choice & { mod: number }>();
  for (const v of values) {
    const key = normKey(v.text);
    const cur = map.get(key);
    if (!cur) map.set(key, { key, label: v.text.trim(), count: 1, mod: v.mod });
    else {
      cur.count++;
      if (v.mod > cur.mod) { cur.label = v.text.trim(); cur.mod = v.mod; }
    }
  }
  return [...map.values()]
    .map(({ key, label, count }) => ({ key, label, count }))
    .sort((a, b) => (a.key === "" ? 1 : b.key === "" ? -1 : a.label.localeCompare(b.label)));
}

/** Stores used so far, for suggestions and filters ("" key = shopping expenses without a store). */
export function storeChoices(claims: Claim[]): Choice[] {
  return choices(claims.filter((c) => groupOf(c.category) === "shopping" && !c.cancelled).map((c) => ({ text: c.store, mod: c.mod })));
}

/** Sub-categories used so far in the given families ("" key = none). */
export function subcategoryChoices(claims: Claim[], groups: Group[]): Choice[] {
  return choices(claims.filter((c) => groups.includes(groupOf(c.category)) && !c.cancelled).map((c) => ({ text: c.subcategory, mod: c.mod })));
}

export type Dimension = "group" | "category" | "store" | "subcategory";

export interface BreakdownRow extends Totals {
  /** Group or category code, or normalised store / sub-category key. */
  key: string;
  /** Display text for stores and sub-categories (empty = none); the code for the others. */
  label: string;
}

export interface MonthGroup extends Totals {
  /** "YYYY-MM" */
  month: string;
  claims: Claim[];
}

export interface Report {
  claims: Claim[];
  totals: Totals;
  dimension: Dimension;
  breakdown: BreakdownRow[];
  months: MonthGroup[];
}

/** What the breakdown splits by, depending on the chosen family. */
export function dimensionFor(f: ReportFilter): Dimension {
  if (f.group === "health") return "category";
  if (f.group === "shopping") return "store";
  if (f.group === "other") return "subcategory";
  return "group";
}

export function buildReport(claims: Claim[], f: ReportFilter, today: Ymd, newestFirst = true): Report {
  const list = reportClaims(claims, f).sort((a, b) => (newestFirst ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)) || a.label.localeCompare(b.label));
  const dimension = dimensionFor(f);

  // Breakdown: one row per group / category / store / sub-category.
  const buckets = new Map<string, { label: string; claims: Claim[]; mod: number }>();
  for (const c of list) {
    const [key, text] =
      dimension === "group" ? [groupOf(c.category), groupOf(c.category)]
      : dimension === "category" ? [c.category, c.category]
      : dimension === "store" ? [normKey(c.store), c.store.trim()]
      : [normKey(c.subcategory), c.subcategory.trim()];
    const b = buckets.get(key) ?? { label: text, claims: [], mod: 0 };
    b.claims.push(c);
    if (c.mod >= b.mod && text) { b.label = text; b.mod = c.mod; }
    buckets.set(key, b);
  }
  const breakdown = [...buckets.entries()]
    .map(([key, b]) => ({ key, label: b.label, ...totalsOf(b.claims, today) }))
    .sort((a, b) => b.advanced - a.advanced || a.label.localeCompare(b.label));

  // Timeline: grouped by month, in the same order as the list.
  const months: MonthGroup[] = [];
  for (const c of list) {
    const month = c.date.slice(0, 7);
    let g = months.find((m) => m.month === month);
    if (!g) { g = { month, claims: [], count: 0, advanced: 0, received: 0, remaining: 0, outOfPocket: 0 }; months.push(g); }
    g.claims.push(c);
  }
  for (const g of months) Object.assign(g, totalsOf(g.claims, today));

  return { claims: list, totals: totalsOf(list, today), dimension, breakdown, months };
}

export const PERIOD_PRESETS = ["this_month", "last_month", "this_year", "last_year", "all"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

/** Date range of a preset, relative to `today`. */
export function periodRange(preset: PeriodPreset, today: Ymd): { from: Ymd; to: Ymd } {
  switch (preset) {
    case "this_month": return { from: startOfMonth(today), to: endOfMonth(today) };
    case "last_month": { const m = addMonths(today, -1); return { from: startOfMonth(m), to: endOfMonth(m) }; }
    case "this_year": return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case "last_year": { const y = addYears(today, -1).slice(0, 4); return { from: `${y}-01-01`, to: `${y}-12-31` }; }
    case "all": return { from: "", to: "" };
  }
}

/** Status shown next to each expense in the timeline. */
export function statusOf(c: Claim, today: Ymd) {
  return claimStatus(c, today);
}

export { GROUPS, HEALTH_CATEGORIES };
