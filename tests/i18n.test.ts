import { afterEach, describe, expect, it } from "vitest";
import * as A from "../src/domain/actions";
import { setLang } from "../src/domain/locale";
import { formatMoney } from "../src/domain/money";
import { buildCsv } from "../src/export/csv";
import { applyLang, strings } from "../src/ui/strings";
import { en } from "../src/ui/strings.en";
import { fr } from "../src/ui/strings.fr";
import { claim, item, NOW, TODAY } from "./fixtures";

afterEach(() => applyLang("en", false));

describe("French", () => {
  it("formats amounts the French way", () => {
    setLang("fr");
    expect(formatMoney(123456)).toBe("1 234,56 €");
  });
  it("writes new journal entries in French, like the prototype", () => {
    setLang("fr");
    const c = claim({ items: [item({ id: "a", source: "mutuelle", expected: 1000 })] });
    expect(A.recordReceipt(c, "a", 600, "2026-06-15", false, NOW).log.at(-1)!.text)
      .toBe("Reçu 6,00 € de Mutuelle le 15/06/2026 : écart de 4,00 € à relancer");
    expect(A.markReturned(claim(), "2026-06-15", "", "", NOW).log.at(-1)!.text).toBe("Article retourné le 15/06/2026");
  });
  it("finds the cancellation reason whatever the language it was written in", () => {
    setLang("fr");
    const c = A.cancelClaim(claim(), "doublon", NOW);
    setLang("en");
    expect(A.lastCancelReason(c)).toBe("doublon");
    expect(A.lastCancelReason(A.cancelClaim(c, "duplicate", NOW))).toBe("duplicate");
  });
  it("switches the UI text and the CSV headers", () => {
    applyLang("fr", false);
    expect(strings.status.late).toBe("En retard");
    expect(strings.inDays(1)).toBe("dans 1 jour");
    expect(strings.inDays(-3)).toBe("dépassé de 3 jours");
    expect(buildCsv([claim({ items: [] })], TODAY).replace(/^﻿/, "").startsWith("Date;Libellé;Catégorie")).toBe(true);
    applyLang("en", false);
    expect(strings.status.late).toBe("Late");
  });
  it("both languages have every text filled in", () => {
    const empty = (o: unknown, path = ""): string[] =>
      typeof o === "string" ? (o.trim() ? [] : [path])
        : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => empty(v, `${path}.${k}`)) : [];
    expect(empty(en)).toEqual([]);
    expect(empty(fr)).toEqual([]);
  });
});
