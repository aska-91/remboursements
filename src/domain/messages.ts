/**
 * Journal entries are stored as text when the action happens, so their
 * wording is fixed here (in English), not in the UI strings.
 */
import type { Source } from "./types";
import { formatDate } from "./dates";
import { formatMoney } from "./money";

export const SOURCE_NAMES: Record<Source, string> = {
  social_security: "Sécurité sociale",
  mutuelle: "Mutuelle",
  retailer: "Retailer",
  other: "Other",
};

const opt = (cond: unknown, s: string) => (cond ? s : "");

export const journal = {
  created: (amount: number) => `Expense created: ${formatMoney(amount)} advanced`,
  edited: () => "Expense edited",
  received: (amount: number, src: Source, date: string, gap: number, writeOff: boolean) =>
    `Received ${formatMoney(amount)} from ${SOURCE_NAMES[src]} on ${formatDate(date)}` +
    opt(gap > 0, `: gap of ${formatMoney(gap)}${writeOff ? ", accepted as out-of-pocket" : " to chase"}`),
  receiptUndone: (src: Source) => `Receipt cancelled (${SOURCE_NAMES[src]})`,
  chased: (src: Source, date: string, text: string, newDue: string) =>
    `Chased ${SOURCE_NAMES[src]} on ${formatDate(date)}` + opt(text, `: ${text}`) +
    opt(newDue, ` · new expected date ${formatDate(newDue)}`),
  refused: (src: Source, reason: string) => `Refused by ${SOURCE_NAMES[src]}: ${reason}`,
  refusalUndone: (src: Source) => `Refusal cancelled (${SOURCE_NAMES[src]})`,
  writtenOff: (amount: number, src: Source) =>
    `Missing ${formatMoney(amount)} (${SOURCE_NAMES[src]}) accepted as out-of-pocket`,
  gapReopened: (src: Source) => `Gap reopened (${SOURCE_NAMES[src]})`,
  sent: (date: string, how: string) => `Request sent on ${formatDate(date)}` + opt(how, ` (${how})`),
  returned: (date: string, tracking: string, refundDue: string) =>
    `Item returned on ${formatDate(date)}` + opt(tracking, ` · tracking ${tracking}`) +
    opt(refundDue, ` · refund expected by ${formatDate(refundDue)}`),
  cancelled: (reason: string) => `Expense cancelled: ${reason}`,
  restored: () => "Expense restored",
  archived: () => "Archived",
  unarchived: () => "Restored from archive",
  note: (date: string, text: string) => `${formatDate(date)}: ${text}`,
};
