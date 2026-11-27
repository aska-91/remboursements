import type { Doc } from "../domain/types";
import { readDoc } from "../domain/data";

/** Full backup: everything needed to restore, including deletion records. */
export function buildBackup(doc: Doc, now: number): string {
  return JSON.stringify({ version: 3, app: "refund-tracker", exportedAt: new Date(now).toISOString(), claims: doc.claims, deleted: doc.deleted }, null, 1);
}

/** Parses a backup file (this app's or the prototype's). Throws if it is not one. */
export function parseBackup(text: string, today: string): Doc {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new Error("Not JSON");
  }
  return readDoc(raw, today);
}
