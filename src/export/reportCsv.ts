import type { Ymd } from "../domain/types";
import { groupOf } from "../domain/types";
import type { Report } from "../domain/report";
import { statusOf } from "../domain/report";
import { formatDate } from "../domain/dates";
import { claimReceived, claimRemaining } from "../domain/status";
import { strings } from "../ui/strings";
import { typeOrStore } from "../ui/labels";

const num = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/** Same spreadsheet-friendly rules as the full export: ';' separator, comma decimals, UTF-8 BOM. */
function cell(v: string, isText = false): string {
  let s = v;
  if (isText && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per expense of the report, in the order shown on screen. */
export function buildReportCsv(report: Report, today: Ymd): string {
  const lines = [strings.history.csvHeaders.join(";")];
  for (const c of report.claims) {
    const advanced = c.amount;
    const received = claimReceived(c);
    const remaining = claimRemaining(c, today);
    lines.push([
      cell(formatDate(c.date)),
      cell(strings.groups[groupOf(c.category)]),
      cell(typeOrStore(c), true),
      cell(c.subcategory, true),
      cell(c.label, true),
      cell(c.ref, true),
      num(advanced), num(received), num(remaining), num(advanced - received - remaining),
      cell(strings.status[statusOf(c, today)]),
    ].join(";"));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
