/**
 * Reading untrusted data (stored, imported or from the prototype) into clean
 * objects, and merging two data sets without losing anything.
 */
import type { Category, Claim, Doc, Item, JournalEntry, RefundMode, Source } from "./types";
import { CATEGORIES, REFUND_MODES, SOURCES } from "./types";
import { isValidYmd, today } from "./dates";
import { toCents } from "./money";
import { newId } from "./actions";

/** Values used by the single-file prototype (French labels, amounts in euros). */
const LEGACY_CATEGORIES: Record<string, Category> = {
  "Médecin généraliste": "gp",
  "Médecin spécialiste": "specialist",
  "Pharmacie": "pharmacy",
  "Dentiste / Optique": "dental_optical",
  "Examens / Analyses": "lab_tests",
  "Retour d'article": "item_return",
  "Autre": "other",
};
const LEGACY_SOURCES: Record<string, Source> = {
  "Sécurité sociale": "social_security", "Mutuelle": "mutuelle", "Enseigne": "retailer", "Autre": "other",
};
const LEGACY_REFUND_MODES: Record<string, RefundMode> = {
  "Sur le moyen de paiement": "original_payment", "Avoir / bon d'achat": "store_credit", "Autre": "other",
};

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const str = (v: unknown): string => (v == null ? "" : String(v));
const date = (v: unknown): string => (isValidYmd(v) ? v : "");
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
function pick<T extends string>(v: unknown, allowed: readonly T[], legacy: Record<string, T>, fallback: T): T {
  const s = str(v);
  if ((allowed as readonly string[]).includes(s)) return s as T;
  return legacy[s] ?? fallback;
}

/** Amounts: cents in the current format, euros in the prototype format. */
function amount(v: unknown, legacy: boolean): number {
  return legacy ? toCents(num(v)) : Math.round(num(v));
}

export function normalizeItem(raw: unknown, legacy: boolean): Item {
  const r = obj(raw);
  const received = r.received == null || r.received === "" ? null : amount(r.received, legacy);
  return {
    id: str(r.id) || newId(),
    source: pick(r.source, SOURCES, LEGACY_SOURCES, "other"),
    expected: amount(r.expected, legacy),
    due: date(r.due),
    received,
    receivedDate: date(r.receivedDate),
    writeOff: !!r.writeOff,
    refused: !!r.refused,
    refusedReason: str(r.refusedReason),
    lastChase: date(r.lastChase),
  };
}

export function normalizeClaim(raw: unknown, legacy: boolean, fallbackDate: string): Claim {
  const r = obj(raw);
  const log: JournalEntry[] = (Array.isArray(r.log) ? r.log : []).map((l) => ({ t: num(obj(l).t), text: str(obj(l).text) }));
  return {
    id: str(r.id) || newId(),
    date: date(r.date) || fallbackDate,
    label: str(r.label),
    category: pick(legacy ? r.cat : r.category, CATEGORIES, LEGACY_CATEGORIES, "other"),
    store: str(r.store).trim(),
    subcategory: str(r.subcategory).trim(),
    amount: amount(r.amount, legacy),
    ref: str(r.ref),
    notes: str(r.notes),
    archived: !!r.archived,
    cancelled: legacy ? r.outcome === "annule" : !!r.cancelled,
    returnBy: date(r.returnBy),
    returnedDate: date(r.returnedDate),
    tracking: str(r.tracking),
    refundMode: pick(r.refundMode, REFUND_MODES, LEGACY_REFUND_MODES, "original_payment"),
    needsRequest: !!r.needsRequest,
    claimBy: date(r.claimBy),
    sentDate: date(r.sentDate),
    log,
    mod: num(r.mod),
    items: (Array.isArray(r.items) ? r.items : []).map((i) => normalizeItem(i, legacy)),
  };
}

/**
 * Brings a record stored by any earlier version of the app up to the current shape
 * (missing fields get their defaults). Applied to everything read from storage, so
 * the rest of the app can rely on every field being there.
 */
export function upgradeClaim(raw: unknown): Claim {
  return normalizeClaim(raw, false, today());
}

/** Accepts the current format (version 3) and the prototype's (v1/v2). Throws if it is not a backup. */
export function readDoc(raw: unknown, fallbackDate: string): Doc {
  const r = obj(raw);
  if (!Array.isArray(r.claims)) throw new Error("Not a backup file: no expense list found");
  const legacy = r.version !== 3;
  const deleted: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(r.deleted))) if (num(v) > 0) deleted[k] = num(v);
  // Entries that are not expenses with an id are skipped: without an id they could not be
  // matched on a later import and would come back as duplicates.
  const valid = r.claims.filter((c) => c && typeof c === "object" && str((c as Raw).id).trim());
  return { version: 3, claims: valid.map((c) => normalizeClaim(c, legacy, fallbackDate)), deleted };
}

export function emptyDoc(): Doc {
  return { version: 3, claims: [], deleted: {} };
}

/**
 * Lossless merge: for each claim the most recently modified version wins
 * (on a tie, `a` is kept); a deletion wins over any version older than it.
 */
export function mergeDocs(a: Doc, b: Doc): Doc {
  const deleted: Record<string, number> = { ...a.deleted };
  for (const [k, v] of Object.entries(b.deleted)) deleted[k] = Math.max(deleted[k] ?? 0, v);
  const byId = new Map<string, Claim>();
  for (const c of [...a.claims, ...b.claims]) {
    const cur = byId.get(c.id);
    if (!cur || c.mod > cur.mod) byId.set(c.id, c);
  }
  const claims = [...byId.values()].filter((c) => !(deleted[c.id] && deleted[c.id]! > c.mod));
  return { version: 3, claims, deleted };
}

export interface ImportResult {
  doc: Doc;
  /** Expenses that did not exist here. */
  added: number;
  /** Existing expenses replaced by a more recent version from the file. */
  updated: number;
  /** Existing expenses removed because the file records a later deletion. */
  removed: number;
}

/** Merges a backup into the current data and counts what changed. */
export function importBackup(current: Doc, incoming: Doc): ImportResult {
  const doc = mergeDocs(current, incoming);
  const before = new Map(current.claims.map((c) => [c.id, c]));
  const after = new Set(doc.claims.map((c) => c.id));
  let added = 0, updated = 0;
  for (const c of doc.claims) {
    const prev = before.get(c.id);
    if (!prev) added++;
    else if (prev !== c) updated++;
  }
  const removed = current.claims.filter((c) => !after.has(c.id)).length;
  return { doc, added, updated, removed };
}
