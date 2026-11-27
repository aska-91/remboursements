import type { Claim, Source, Ymd } from "./types";
import { REQUEST_ALERT_DAYS, RETURN_ALERT_DAYS } from "./types";
import { daysBetween } from "./dates";
import { gap, isShop, itemState } from "./status";

/** "To do" entries. Text is built by the UI from these fields. */
export type Alert =
  | { kind: "return_overdue" | "return_soon"; claimId: string; days: number; severity: 0 | 1 }
  | { kind: "request_overdue" | "request_soon"; claimId: string; days: number; deadline: Ymd; severity: 0 | 1 }
  | { kind: "item_late"; claimId: string; itemId: string; source: Source; amount: number; days: number; severity: 0 }
  | { kind: "item_gap"; claimId: string; itemId: string; source: Source; amount: number; severity: 1 };

/**
 * Sorted by severity (overdue first), then by days left.
 * `days` is days until the deadline (negative = overdue by that many days).
 */
export function buildAlerts(claims: Claim[], today: Ymd): Alert[] {
  const out: { a: Alert; key: number }[] = [];
  for (const c of claims) {
    if (c.archived || c.cancelled) continue;
    if (isShop(c) && !c.returnedDate && c.returnBy) {
      const d = daysBetween(today, c.returnBy);
      if (d < 0) out.push({ key: d, a: { kind: "return_overdue", claimId: c.id, days: d, severity: 0 } });
      else if (d <= RETURN_ALERT_DAYS) out.push({ key: d, a: { kind: "return_soon", claimId: c.id, days: d, severity: 1 } });
    }
    if (!isShop(c) && c.needsRequest && !c.sentDate && c.claimBy) {
      const d = daysBetween(today, c.claimBy);
      if (d < 0) out.push({ key: d, a: { kind: "request_overdue", claimId: c.id, days: d, deadline: c.claimBy, severity: 0 } });
      else if (d <= REQUEST_ALERT_DAYS) out.push({ key: d, a: { kind: "request_soon", claimId: c.id, days: d, deadline: c.claimBy, severity: 1 } });
    }
    for (const i of c.items) {
      const s = itemState(c, i, today);
      if (s === "late") {
        const d = daysBetween(today, i.due);
        out.push({ key: d, a: { kind: "item_late", claimId: c.id, itemId: i.id, source: i.source, amount: i.expected, days: d, severity: 0 } });
      } else if (s === "gap") {
        out.push({ key: -1, a: { kind: "item_gap", claimId: c.id, itemId: i.id, source: i.source, amount: gap(i), severity: 1 } });
      }
    }
  }
  out.sort((x, y) => x.a.severity - y.a.severity || x.key - y.key);
  return out.map((x) => x.a);
}
