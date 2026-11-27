import type { Claim, Source, Ymd } from "./types";
import { SOURCES } from "./types";
import { claimReceived, claimRemaining, itemRemaining, itemState } from "./status";

export interface Summary {
  /** Still to receive (pending + late lines, plus missing part of gaps). */
  remaining: number;
  /** Number of lines with something still to receive. */
  remainingCount: number;
  /** Part of `remaining` that is late or a gap. */
  atRisk: number;
  received: number;
  advanced: number;
  /** Expected out-of-pocket = advanced − received − remaining. */
  outOfPocket: number;
}

/** Cancelled claims are excluded; archived ones are included (as in the prototype). */
export function summary(claims: Claim[], today: Ymd): Summary {
  let advanced = 0, received = 0, remaining = 0, remainingCount = 0, atRisk = 0;
  for (const c of claims) {
    if (c.cancelled) continue;
    advanced += c.amount;
    received += claimReceived(c);
    for (const i of c.items) {
      const r = itemRemaining(c, i, today);
      if (r > 0) {
        remaining += r;
        remainingCount++;
        const s = itemState(c, i, today);
        if (s === "late" || s === "gap") atRisk += r;
      }
    }
  }
  return { remaining, remainingCount, atRisk, received, advanced, outOfPocket: advanced - received - remaining };
}

export function remainingBySource(claims: Claim[], today: Ymd): Record<Source, number> {
  const out = Object.fromEntries(SOURCES.map((s) => [s, 0])) as Record<Source, number>;
  for (const c of claims) {
    if (c.cancelled) continue;
    for (const i of c.items) out[i.source] += itemRemaining(c, i, today);
  }
  return out;
}

export interface YearTotals {
  year: string;
  count: number;
  advanced: number;
  received: number;
  remaining: number;
  outOfPocket: number;
}

/** Totals per year of expense date, most recent year first. */
export function yearlyTotals(claims: Claim[], today: Ymd): YearTotals[] {
  const years = new Map<string, YearTotals>();
  for (const c of claims) {
    if (c.cancelled) continue;
    const year = c.date.slice(0, 4);
    const y = years.get(year) ?? { year, count: 0, advanced: 0, received: 0, remaining: 0, outOfPocket: 0 };
    y.count++;
    y.advanced += c.amount;
    y.received += claimReceived(c);
    y.remaining += claimRemaining(c, today);
    years.set(year, y);
  }
  return [...years.values()]
    .map((y) => ({ ...y, outOfPocket: y.advanced - y.received - y.remaining }))
    .sort((a, b) => b.year.localeCompare(a.year));
}
