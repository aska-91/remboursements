/**
 * Journal entries are stored as text when the action happens, in the language
 * active at that moment. Their wording lives here, not in the UI strings.
 */
import type { Source } from "./types";
import { formatDate } from "./dates";
import { formatMoney as m } from "./money";
import { getLang, type Lang } from "./locale";

const SOURCES_BY_LANG: Record<Lang, Record<Source, string>> = {
  en: { social_security: "Sécurité sociale", mutuelle: "Mutuelle", retailer: "Retailer", other: "Other" },
  fr: { social_security: "Sécurité sociale", mutuelle: "Mutuelle", retailer: "Enseigne", other: "Autre" },
};

export function sourceNames(lang: Lang = getLang()): Record<Source, string> {
  return SOURCES_BY_LANG[lang];
}

const opt = (cond: unknown, s: string) => (cond ? s : "");
const fd = formatDate;

const en = {
  created: (amount: number) => `Expense created: ${m(amount)} advanced`,
  edited: (removed: string[]) => "Expense edited" + opt(removed.length, ` · line removed: ${removed.join(", ")}`),
  received: (amount: number, src: string, date: string, gap: number, writeOff: boolean) =>
    `Received ${m(amount)} from ${src} on ${fd(date)}` +
    opt(gap > 0, `: gap of ${m(gap)}${writeOff ? ", accepted as out-of-pocket" : " to chase"}`),
  receiptUndone: (src: string) => `Receipt cancelled (${src})`,
  chased: (src: string, date: string, text: string, newDue: string) =>
    `Chased ${src} on ${fd(date)}` + opt(text, `: ${text}`) + opt(newDue, ` · new expected date ${fd(newDue)}`),
  refused: (src: string, reason: string) => `Refused by ${src}: ${reason}`,
  refusalUndone: (src: string) => `Refusal cancelled (${src})`,
  writtenOff: (amount: number, src: string) => `Missing ${m(amount)} (${src}) accepted as out-of-pocket`,
  gapReopened: (src: string) => `Gap reopened (${src})`,
  sent: (date: string, how: string) => `Request sent on ${fd(date)}` + opt(how, ` (${how})`),
  returned: (date: string, tracking: string, refundDue: string) =>
    `Item returned on ${fd(date)}` + opt(tracking, ` · tracking ${tracking}`) + opt(refundDue, ` · refund expected by ${fd(refundDue)}`),
  cancelled: (reason: string) => `Expense cancelled: ${reason}`,
  restored: () => "Expense restored",
  archived: () => "Archived",
  unarchived: () => "Restored from archive",
  note: (date: string, text: string) => `${fd(date)}: ${text}`,
};

/** Same wording as the prototype where it existed. */
const fr: typeof en = {
  created: (amount) => `Dépense créée : ${m(amount)} avancés`,
  edited: (removed) => "Dépense modifiée" + opt(removed.length, ` · ligne retirée : ${removed.join(", ")}`),
  received: (amount, src, date, gap, writeOff) =>
    `Reçu ${m(amount)} de ${src} le ${fd(date)}` +
    opt(gap > 0, ` : écart de ${m(gap)}${writeOff ? ", classé en reste à charge" : " à relancer"}`),
  receiptUndone: (src) => `Réception annulée (${src})`,
  chased: (src, date, text, newDue) =>
    `Relance ${src} le ${fd(date)}` + opt(text, ` : ${text}`) + opt(newDue, ` · nouvelle date prévue le ${fd(newDue)}`),
  refused: (src, reason) => `Refus ${src} : ${reason}`,
  refusalUndone: (src) => `Refus annulé (${src})`,
  writtenOff: (amount, src) => `Manque de ${m(amount)} (${src}) classé en reste à charge`,
  gapReopened: (src) => `Écart rouvert (${src})`,
  sent: (date, how) => `Demande envoyée le ${fd(date)}` + opt(how, ` (${how})`),
  returned: (date, tracking, refundDue) =>
    `Article retourné le ${fd(date)}` + opt(tracking, ` · suivi ${tracking}`) + opt(refundDue, ` · remboursement attendu avant le ${fd(refundDue)}`),
  cancelled: (reason) => `Dépense annulée : ${reason}`,
  restored: () => "Dépense rétablie",
  archived: () => "Archivée",
  unarchived: () => "Restaurée depuis les archives",
  note: (date, text) => `${fd(date)} : ${text}`,
};

const BY_LANG: Record<Lang, typeof en> = { en, fr };

/** Journal texts in the current language; sources are given as codes. */
export const journal = {
  created: (amount: number) => BY_LANG[getLang()].created(amount),
  edited: (removed: { source: Source; expected: number }[] = []) =>
    BY_LANG[getLang()].edited(removed.map((r) => `${sourceNames()[r.source]} ${m(r.expected)}`)),
  received: (amount: number, src: Source, date: string, gap: number, writeOff: boolean) =>
    BY_LANG[getLang()].received(amount, sourceNames()[src], date, gap, writeOff),
  receiptUndone: (src: Source) => BY_LANG[getLang()].receiptUndone(sourceNames()[src]),
  chased: (src: Source, date: string, text: string, newDue: string) => BY_LANG[getLang()].chased(sourceNames()[src], date, text, newDue),
  refused: (src: Source, reason: string) => BY_LANG[getLang()].refused(sourceNames()[src], reason),
  refusalUndone: (src: Source) => BY_LANG[getLang()].refusalUndone(sourceNames()[src]),
  writtenOff: (amount: number, src: Source) => BY_LANG[getLang()].writtenOff(amount, sourceNames()[src]),
  gapReopened: (src: Source) => BY_LANG[getLang()].gapReopened(sourceNames()[src]),
  sent: (date: string, how: string) => BY_LANG[getLang()].sent(date, how),
  returned: (date: string, tracking: string, refundDue: string) => BY_LANG[getLang()].returned(date, tracking, refundDue),
  cancelled: (reason: string) => BY_LANG[getLang()].cancelled(reason),
  restored: () => BY_LANG[getLang()].restored(),
  archived: () => BY_LANG[getLang()].archived(),
  unarchived: () => BY_LANG[getLang()].unarchived(),
  note: (date: string, text: string) => BY_LANG[getLang()].note(date, text),
};

/** Prefixes of a cancellation entry in every language, to find the reason again. */
export const CANCEL_PREFIXES = [en.cancelled(""), fr.cancelled("")];
