/** Calendar date "YYYY-MM-DD" (Europe/Paris), or "" when not set. */
export type Ymd = string;
/** Integer amount in euro cents. */
export type Cents = number;
/** Milliseconds since epoch. */
export type Timestamp = number;

export const CATEGORIES = [
  "gp", "specialist", "pharmacy", "dental_optical", "lab_tests", "item_return", "other",
] as const;
export type Category = (typeof CATEGORIES)[number];
/** The only "shopping" category; every other one is a health expense. */
export const SHOP_CATEGORY: Category = "item_return";

export const SOURCES = ["social_security", "mutuelle", "retailer", "other"] as const;
export type Source = (typeof SOURCES)[number];

export const REFUND_MODES = ["original_payment", "store_credit", "other"] as const;
export type RefundMode = (typeof REFUND_MODES)[number];

export interface JournalEntry {
  t: Timestamp;
  text: string;
}

/** One expected refund line (e.g. the Sécurité sociale part of a doctor visit). */
export interface Item {
  id: string;
  source: Source;
  expected: Cents;
  due: Ymd;
  /** Cumulated amount received, or null if nothing received yet. */
  received: Cents | null;
  receivedDate: Ymd;
  /** Missing amount accepted as out-of-pocket. */
  writeOff: boolean;
  refused: boolean;
  refusedReason: string;
  lastChase: Ymd;
}

export interface Claim {
  id: string;
  date: Ymd;
  label: string;
  category: Category;
  amount: Cents;
  ref: string;
  notes: string;
  archived: boolean;
  cancelled: boolean;
  // Shopping
  returnBy: Ymd;
  returnedDate: Ymd;
  tracking: string;
  refundMode: RefundMode;
  // Health
  needsRequest: boolean;
  claimBy: Ymd;
  sentDate: Ymd;
  log: JournalEntry[];
  mod: Timestamp;
  items: Item[];
}

/** Whole data set as stored and exported. */
export interface Doc {
  version: 3;
  claims: Claim[];
  /** Permanently deleted claim ids → deletion time, so merges do not bring them back. */
  deleted: Record<string, Timestamp>;
}

export type ItemState = "refused" | "received" | "gap" | "written_off" | "late" | "pending";

export type ClaimStatus =
  | "cancelled" | "to_return" | "late" | "gap" | "to_send"
  | "partial" | "pending" | "received" | "refused";

export const DEFAULT_DELAY_DAYS: Record<Source, number> = {
  social_security: 7, mutuelle: 14, retailer: 14, other: 14,
};
export const REFUND_DAYS_AFTER_RETURN = 14;
export const CLAIM_DEADLINE_YEARS = 2;
export const RETURN_ALERT_DAYS = 7;
export const REQUEST_ALERT_DAYS = 30;
