import type { Claim, Ymd } from "../domain/types";
import { groupOf } from "../domain/types";
import { claimStatus, gap, itemState } from "../domain/status";
import { formatDate, formatDateTime } from "../domain/dates";
import { strings } from "../ui/strings";

/** Semicolon-separated with comma decimals, so it opens directly in a French Excel. */
const SEP = ";";

/** Amount in cents → "12,50" */
function num(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Quotes when needed; neutralises text that a spreadsheet would run as a formula. */
function cell(v: string, isText = false): string {
  let s = v;
  if (isText && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per refund line (one row with empty line columns for an expense without lines). */
export function buildCsv(claims: Claim[], today: Ymd): string {
  const S = strings;
  const lines = [S.csv.headers.join(SEP)];
  for (const c of claims) {
    const history = [...c.log].sort((a, b) => a.t - b.t).map((l) => `${formatDateTime(l.t)} ${l.text}`).join(" | ");
    const head = [
      cell(formatDate(c.date)), cell(c.label, true), cell(S.categories[c.category]), cell(S.groups[groupOf(c.category)]),
      cell(c.store, true), cell(c.subcategory, true), cell(c.ref, true), num(c.amount),
      cell(S.status[claimStatus(c, today)]), c.archived ? S.csv.yes : S.csv.no,
    ];
    const tail = [
      cell(formatDate(c.returnBy)), cell(formatDate(c.returnedDate)), cell(c.tracking, true),
      cell(formatDate(c.claimBy)), cell(formatDate(c.sentDate)), cell(c.notes, true), cell(history, true),
    ];
    const items = c.items.length ? c.items : [null];
    for (const i of items) {
      const mid = i
        ? [
            cell(S.sources[i.source]), num(i.expected), cell(formatDate(i.due)),
            i.received != null ? num(i.received) : "", i.received != null ? num(Math.max(0, gap(i))) : "",
            cell(formatDate(i.receivedDate)), cell(c.cancelled ? S.csv.cancelled : S.csv.itemStatus[itemState(c, i, today)]), cell(i.refusedReason, true),
          ]
        : ["", "", "", "", "", "", "", ""];
      lines.push([...head, ...mid, ...tail].join(SEP));
    }
  }
  // BOM so Excel reads the file as UTF-8 (accents, € sign).
  return "﻿" + lines.join("\r\n") + "\r\n";
}
