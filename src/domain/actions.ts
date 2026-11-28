/**
 * Every user action as a pure function: it returns a new claim (input untouched),
 * bumps `mod` and appends a journal entry. `now` is the action time.
 */
import type { Category, Claim, Cents, Doc, Item, RefundMode, Source, Timestamp, Ymd } from "./types";
import { CLAIM_DEADLINE_YEARS, DEFAULT_DELAY_DAYS, REFUND_DAYS_AFTER_RETURN, SHOP_CATEGORY, groupOf } from "./types";
import { addDays, addYears } from "./dates";
import { gap, isClosed, itemReceived } from "./status";
import { CANCEL_PREFIXES, journal } from "./messages";

export function newId(): string {
  return crypto.randomUUID();
}

function logged(c: Claim, text: string, now: Timestamp): Claim {
  return { ...c, log: [...c.log, { t: now, text }], mod: now };
}

function updateItem(c: Claim, itemId: string, f: (i: Item) => Item): Claim {
  if (!c.items.some((i) => i.id === itemId)) throw new Error(`Unknown item ${itemId}`);
  return { ...c, items: c.items.map((i) => (i.id === itemId ? f(i) : i)) };
}

function findItem(c: Claim, itemId: string): Item {
  const i = c.items.find((x) => x.id === itemId);
  if (!i) throw new Error(`Unknown item ${itemId}`);
  return i;
}

// ---------- form ----------

export function blankItem(source: Source, due: Ymd, expected: Cents = 0): Item {
  return {
    id: newId(), source, expected, due, received: null, receivedDate: "",
    writeOff: false, refused: false, refusedReason: "", lastChase: "",
  };
}

/** Default expected date for a new line: expense date + source delay; none for a return not yet shipped. */
export function defaultDue(source: Source, date: Ymd, category: Category): Ymd {
  return category === SHOP_CATEGORY ? "" : addDays(date, DEFAULT_DELAY_DAYS[source]);
}

/** Pre-filled lines: Retailer for a return, Sécurité sociale + Mutuelle otherwise. */
export function defaultItems(category: Category, date: Ymd, amount: Cents): Item[] {
  if (category === SHOP_CATEGORY) return [blankItem("retailer", "", amount)];
  return [
    blankItem("social_security", defaultDue("social_security", date, category)),
    blankItem("mutuelle", defaultDue("mutuelle", date, category)),
  ];
}

/** Suggested deadline to send a health claim (to check against the contract). */
export function defaultClaimBy(date: Ymd): Ymd {
  return addYears(date, CLAIM_DEADLINE_YEARS);
}

export function defaultRefundDue(returnedDate: Ymd): Ymd {
  return addDays(returnedDate, REFUND_DAYS_AFTER_RETURN);
}

export interface ClaimInput {
  date: Ymd;
  label: string;
  category: Category;
  store: string;
  subcategory: string;
  amount: Cents;
  ref: string;
  notes: string;
  returnBy: Ymd;
  returnedDate: Ymd;
  tracking: string;
  refundMode: RefundMode;
  needsRequest: boolean;
  claimBy: Ymd;
  sentDate: Ymd;
  /** Edited lines; existing ones keep their receipt/refusal data (matched by id). */
  items: Pick<Item, "id" | "source" | "expected" | "due">[];
}

function applyInput(base: Claim, input: ClaimInput): Claim {
  const shop = input.category === SHOP_CATEGORY;
  const returnedDate = shop ? input.returnedDate : "";
  const needsRequest = !shop && input.needsRequest;
  const items = input.items.map((x) => {
    const prev = base.items.find((i) => i.id === x.id);
    const it: Item = { ...(prev ?? blankItem(x.source, x.due)), id: x.id, source: x.source, expected: x.expected, due: x.due };
    if (shop && returnedDate && it.received == null && !it.due) it.due = defaultRefundDue(returnedDate);
    return it;
  });
  return {
    ...base,
    date: input.date,
    label: input.label.trim(),
    category: input.category,
    store: shop ? input.store.trim() : "",
    subcategory: groupOf(input.category) === "health" ? "" : input.subcategory.trim(),
    amount: input.amount,
    ref: input.ref.trim(),
    notes: input.notes.trim(),
    refundMode: input.refundMode,
    returnBy: shop ? input.returnBy : "",
    returnedDate,
    tracking: shop ? input.tracking.trim() : "",
    needsRequest,
    claimBy: needsRequest ? input.claimBy : "",
    sentDate: needsRequest ? input.sentDate : "",
    items,
  };
}

/** A shopping expense needs a store, otherwise the history by store would be incomplete. */
function check(input: ClaimInput): void {
  if (!input.label.trim()) throw new Error("Label is required");
  if (input.category === SHOP_CATEGORY && !input.store.trim()) throw new Error("Store is required");
}

export function createClaim(input: ClaimInput, now: Timestamp): Claim {
  check(input);
  const empty: Claim = {
    id: newId(), date: input.date, label: "", category: input.category, store: "", subcategory: "", amount: 0, ref: "", notes: "",
    archived: false, cancelled: false, returnBy: "", returnedDate: "", tracking: "", refundMode: "original_payment",
    needsRequest: false, claimBy: "", sentDate: "", log: [], mod: now, items: [],
  };
  const c = applyInput(empty, input);
  return logged(c, journal.created(c.amount), now);
}

/** A line that received money or was refused is part of the history: it cannot be removed. */
export function isLocked(i: Item): boolean {
  return i.received != null || i.refused;
}

export function editClaim(c: Claim, input: ClaimInput, now: Timestamp): Claim {
  check(input);
  const kept = new Set(input.items.map((i) => i.id));
  const removed = c.items.filter((i) => !kept.has(i.id));
  if (removed.some(isLocked)) throw new Error("A line with a receipt or a refusal cannot be removed");
  return logged(applyInput(c, input), journal.edited(removed.map((i) => ({ source: i.source, expected: i.expected }))), now);
}

// ---------- refund lines ----------

/** Amount to pre-fill in the receipt dialog: the missing part, or the expected amount. */
export function suggestedReceipt(i: Item): Cents {
  return i.received != null ? gap(i) : i.expected;
}

/** What would still be missing after receiving `amount` now. */
export function gapAfterReceipt(i: Item, amount: Cents): Cents {
  return i.expected - itemReceived(i) - amount;
}

/**
 * Records a payment (cumulated with earlier ones). If something is still missing,
 * `writeOffGap` decides between "accepted as out-of-pocket" and "gap to chase".
 */
export function recordReceipt(c: Claim, itemId: string, amount: Cents, date: Ymd, writeOffGap: boolean, now: Timestamp): Claim {
  if (!(amount > 0)) throw new Error("The amount received must be more than 0");
  const i = findItem(c, itemId);
  const received = itemReceived(i) + amount;
  const g = i.expected - received;
  const writeOff = g > 0 && writeOffGap;
  const next = updateItem(c, itemId, (x) => ({ ...x, received, receivedDate: date, writeOff }));
  return logged(next, journal.received(amount, i.source, date, g, writeOff), now);
}

export function undoReceipt(c: Claim, itemId: string, now: Timestamp): Claim {
  const i = findItem(c, itemId);
  const next = updateItem(c, itemId, (x) => ({ ...x, received: null, receivedDate: "", writeOff: false }));
  return logged(next, journal.receiptUndone(i.source), now);
}

export function recordChase(c: Claim, itemId: string, date: Ymd, text: string, newDue: Ymd, now: Timestamp): Claim {
  const i = findItem(c, itemId);
  const t = text.trim();
  const next = updateItem(c, itemId, (x) => ({ ...x, lastChase: date, due: newDue || x.due }));
  return logged(next, journal.chased(i.source, date, t, newDue), now);
}

export function refuseItem(c: Claim, itemId: string, reason: string, now: Timestamp): Claim {
  const r = reason.trim();
  if (!r) throw new Error("A reason is required");
  const i = findItem(c, itemId);
  const next = updateItem(c, itemId, (x) => ({ ...x, refused: true, refusedReason: r }));
  return logged(next, journal.refused(i.source, r), now);
}

export function undoRefusal(c: Claim, itemId: string, now: Timestamp): Claim {
  const i = findItem(c, itemId);
  const next = updateItem(c, itemId, (x) => ({ ...x, refused: false, refusedReason: "" }));
  return logged(next, journal.refusalUndone(i.source), now);
}

export function writeOffGap(c: Claim, itemId: string, now: Timestamp): Claim {
  const i = findItem(c, itemId);
  const next = updateItem(c, itemId, (x) => ({ ...x, writeOff: true }));
  return logged(next, journal.writtenOff(gap(i), i.source), now);
}

export function reopenGap(c: Claim, itemId: string, now: Timestamp): Claim {
  const i = findItem(c, itemId);
  const next = updateItem(c, itemId, (x) => ({ ...x, writeOff: false }));
  return logged(next, journal.gapReopened(i.source), now);
}

// ---------- claim steps ----------

export function markSent(c: Claim, date: Ymd, how: string, now: Timestamp): Claim {
  return logged({ ...c, sentDate: date }, journal.sent(date, how.trim()), now);
}

/** Lines not yet received nor refused get `refundDue` as their expected date (if given). */
export function markReturned(c: Claim, date: Ymd, tracking: string, refundDue: Ymd, now: Timestamp): Claim {
  const t = tracking.trim();
  const items = c.items.map((i) => (i.received == null && !i.refused && refundDue ? { ...i, due: refundDue } : i));
  return logged({ ...c, returnedDate: date, tracking: t || c.tracking, items }, journal.returned(date, t, refundDue), now);
}

export function cancelClaim(c: Claim, reason: string, now: Timestamp): Claim {
  const r = reason.trim();
  if (!r) throw new Error("A reason is required");
  return logged({ ...c, cancelled: true }, journal.cancelled(r), now);
}

export function restoreClaim(c: Claim, now: Timestamp): Claim {
  return logged({ ...c, cancelled: false }, journal.restored(), now);
}

export function addNote(c: Claim, date: Ymd, text: string, now: Timestamp): Claim {
  const t = text.trim();
  if (!t) throw new Error("Note is empty");
  return logged(c, journal.note(date, t), now);
}

/** Text of the most recent cancellation (in any language), to show on a cancelled card. */
export function lastCancelReason(c: Claim): string {
  for (let k = c.log.length - 1; k >= 0; k--) {
    const text = c.log[k]!.text;
    const prefix = CANCEL_PREFIXES.find((p) => text.startsWith(p));
    if (prefix) return text.slice(prefix.length);
  }
  return "";
}

// ---------- archive and delete ----------

export function archiveClaim(c: Claim, today: Ymd, now: Timestamp): Claim {
  if (!isClosed(c, today)) throw new Error("Only finished, refused or cancelled expenses can be archived");
  return logged({ ...c, archived: true }, journal.archived(), now);
}

export function unarchiveClaim(c: Claim, now: Timestamp): Claim {
  return logged({ ...c, archived: false }, journal.unarchived(), now);
}

/** Permanent deletion, only from the archive. The id is remembered so a later merge does not restore it. */
export function deleteClaim(doc: Doc, id: string, now: Timestamp): Doc {
  const c = doc.claims.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown claim ${id}`);
  if (!c.archived) throw new Error("Only archived expenses can be deleted");
  return { ...doc, claims: doc.claims.filter((x) => x.id !== id), deleted: { ...doc.deleted, [id]: now } };
}
