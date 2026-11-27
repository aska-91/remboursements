import type { Claim, ClaimStatus, Item, ItemState, Ymd } from "./types";
import { SHOP_CATEGORY } from "./types";

export function isShop(c: Claim): boolean {
  return c.category === SHOP_CATEGORY;
}

/** Shopping item not yet sent back: its refund lines are on hold. */
export function awaitingReturn(c: Claim): boolean {
  return isShop(c) && !c.returnedDate;
}

/** Amount still missing on a line that received something (0 if nothing received). */
export function gap(i: Item): number {
  return i.received == null ? 0 : i.expected - i.received;
}

export function itemState(c: Claim, i: Item, today: Ymd): ItemState {
  if (i.refused) return "refused";
  if (i.received != null) {
    if (gap(i) > 0) return i.writeOff ? "written_off" : "gap";
    return "received";
  }
  if (awaitingReturn(c)) return "pending";
  if (i.due && i.due < today) return "late";
  return "pending";
}

export function itemOpen(c: Claim, i: Item, today: Ymd): boolean {
  const s = itemState(c, i, today);
  return s === "pending" || s === "late" || s === "gap";
}

/** What is still expected on this line. */
export function itemRemaining(c: Claim, i: Item, today: Ymd): number {
  const s = itemState(c, i, today);
  if (s === "pending" || s === "late") return i.expected;
  if (s === "gap") return gap(i);
  return 0;
}

export function itemReceived(i: Item): number {
  return i.received ?? 0;
}

/** Order of checks matters: it mirrors the prototype exactly. */
export function claimStatus(c: Claim, today: Ymd): ClaimStatus {
  if (c.cancelled) return "cancelled";
  if (awaitingReturn(c)) return c.returnBy && c.returnBy < today ? "late" : "to_return";
  if (c.needsRequest && !c.sentDate && c.claimBy && c.claimBy < today) return "late";
  const states = c.items.map((i) => itemState(c, i, today));
  const open = c.items.some((i) => itemOpen(c, i, today));
  if (!open && c.items.length) return states.includes("refused") ? "refused" : "received";
  if (states.includes("late")) return "late";
  if (states.includes("gap")) return "gap";
  if (c.needsRequest && !c.sentDate) return "to_send";
  return c.items.some((i) => i.received != null) ? "partial" : "pending";
}

/** A claim can be archived only once it is over. */
export function isClosed(c: Claim, today: Ymd): boolean {
  const s = claimStatus(c, today);
  return s === "received" || s === "refused" || s === "cancelled";
}

export function claimRemaining(c: Claim, today: Ymd): number {
  if (c.cancelled) return 0;
  return c.items.reduce((s, i) => s + itemRemaining(c, i, today), 0);
}

export function claimReceived(c: Claim): number {
  if (c.cancelled) return 0;
  return c.items.reduce((s, i) => s + itemReceived(i), 0);
}

/** Earliest due date among open lines ("9999-12-31" if none), used for sorting. */
export function nextDue(c: Claim, today: Ymd): Ymd {
  const dues = c.items.filter((i) => itemOpen(c, i, today)).map((i) => i.due).filter(Boolean).sort();
  return dues[0] ?? "9999-12-31";
}
