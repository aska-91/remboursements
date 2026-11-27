/**
 * Runs the real prototype code (prototype/index.html) on hundreds of random
 * expenses and checks that the new domain code gives the same results.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAlerts } from "../src/domain/alerts";
import { mergeDocs, readDoc } from "../src/domain/data";
import { compareClaims, LIST_FILTERS, matchesFilter } from "../src/domain/list";
import { claimReceived, claimRemaining, claimStatus, itemState, nextDue } from "../src/domain/status";
import { summary, yearlyTotals } from "../src/domain/totals";
import type { ClaimStatus, ItemState } from "../src/domain/types";

const html = readFileSync(new URL("../prototype/index.html", import.meta.url), "utf8");
const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const between = (a: string, b: string) => script.slice(script.indexOf(a), script.indexOf(b));

// Constants, helpers, model, merge and alerts, taken verbatim; DOM-only functions are stubbed.
const source = [
  between("var CATS=", "var state="),
  "var state={claims:[],deleted:{}};",
  between("function uid()", "/* ---------- modèle"),
  between("/* ---------- modèle", "/* ---------- stockage"),
  between("function mergeDocs", "function readSnap"),
  between("/* ---------- alertes", "function renderAlerts"),
  "var __today; todayStr=function(){return __today};",
  "function askReturned(){} function askSent(){} function askChase(){} function openRecv(){} function writeOff(){}",
  `return {
    setToday:function(t){__today=t}, setClaims:function(c){state.claims=c},
    normalize:normalize, itemState:itemState, claimStatus:claimStatus, claimRemaining:claimRemaining,
    claimReceived:claimReceived, nextDue:nextDue, inFilter:inFilter, buildAlerts:buildAlerts, mergeDocs:mergeDocs, PRIO:PRIO
  };`,
].join("\n");
const P = new Function(source)() as Record<string, any>;

const ITEM: Record<string, ItemState> = { refuse: "refused", recu: "received", ecart: "gap", solde: "written_off", retard: "late", attente: "pending" };
const STATUS: Record<string, ClaimStatus> = {
  annule: "cancelled", aretourner: "to_return", retard: "late", ecart: "gap", aenvoyer: "to_send",
  partiel: "partial", attente: "pending", recu: "received", refuse: "refused",
};
const FILTER: Record<string, string> = {
  in_progress: "en_cours", to_chase: "relancer", done: "terminees", refused_cancelled: "refusees", archived: "archives", all: "tous",
};

// Small deterministic random generator, so a failure can be reproduced.
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
const maybe = <T,>(v: T, p = 0.5): T | "" => (rnd() < p ? v : "");
const TODAY = "2026-06-15";
const DATES = ["2024-02-29", "2026-05-01", "2026-06-01", "2026-06-14", TODAY, "2026-06-16", "2026-06-22", "2026-06-23", "2026-07-15", "2026-07-16", "2027-01-01"];
const round2 = (n: number) => Math.round(n * 100) / 100;
const euros = () => pick([0, 0.01, 9.99, 10, 25.5, 30, 0.1 + 0.2, 120.45]);

function randomRawClaim(k: number) {
  const items = Array.from({ length: Math.floor(rnd() * 4) }, (_, j) => {
    const expected = euros();
    // Rounded to the cent like the prototype stores them (inputs step 0.01, receipts round2).
    const received = rnd() < 0.5 ? null : round2(pick([expected, expected - 0.01, expected / 2, expected + 1, 0]));
    return {
      id: `i${k}-${j}`, source: pick(["Sécurité sociale", "Mutuelle", "Enseigne", "Autre"]), expected, due: maybe(pick(DATES), 0.8),
      received, receivedDate: received == null ? "" : pick(DATES), writeOff: rnd() < 0.3, refused: rnd() < 0.15,
      refusedReason: "x", lastChase: "",
    };
  });
  return {
    id: `c${k}`, date: pick(DATES), label: `L${k}`, amount: round2(euros() * 3),
    cat: pick(["Médecin généraliste", "Pharmacie", "Retour d'article", "Retour d'article", "Autre"]),
    archived: rnd() < 0.2, outcome: rnd() < 0.1 ? "annule" : "",
    returnBy: maybe(pick(DATES)), returnedDate: maybe(pick(DATES)), needsRequest: rnd() < 0.4,
    claimBy: maybe(pick(DATES), 0.7), sentDate: maybe(pick(DATES), 0.3),
    log: [], mod: Math.floor(rnd() * 5), items,
  };
}

describe("same results as the prototype", () => {
  P.setToday(TODAY);
  const raws = Array.from({ length: 600 }, (_, k) => randomRawClaim(k));
  const old = raws.map((r) => P.normalize(r));
  const neu = readDoc({ claims: raws }, TODAY).claims;
  const cents = (euros: number) => Math.round(euros * 100);

  it("line states", () => {
    old.forEach((c, k) => c.items.forEach((i: unknown, j: number) =>
      expect(itemState(neu[k]!, neu[k]!.items[j]!, TODAY), `claim ${k} line ${j}`).toBe(ITEM[P.itemState(c, i)])));
  });
  it("expense statuses and amounts", () => {
    old.forEach((c, k) => {
      expect(claimStatus(neu[k]!, TODAY), `claim ${k}`).toBe(STATUS[P.claimStatus(c)]);
      expect(claimRemaining(neu[k]!, TODAY), `claim ${k}`).toBe(cents(P.claimRemaining(c)));
      expect(claimReceived(neu[k]!), `claim ${k}`).toBe(cents(P.claimReceived(c)));
      expect(nextDue(neu[k]!, TODAY), `claim ${k}`).toBe(P.nextDue(c));
    });
  });
  it("list filters and urgency order", () => {
    for (const f of LIST_FILTERS) old.forEach((c, k) => expect(matchesFilter(neu[k]!, f, TODAY)).toBe(P.inFilter(c, FILTER[f])));
    const prio = (c: unknown) => P.PRIO[P.claimStatus(c)];
    for (let k = 0; k + 1 < old.length; k++) {
      const a = prio(old[k]), b = prio(old[k + 1]);
      if (a !== b) expect(Math.sign(compareClaims(neu[k]!, neu[k + 1]!, TODAY))).toBe(Math.sign(a - b));
    }
  });
  it("to-do list (same entries, same order)", () => {
    P.setClaims(old);
    const o = P.buildAlerts().map((a: { text: string }) => a.text);
    const n = buildAlerts(neu, TODAY);
    expect(n).toHaveLength(o.length);
    // Each prototype alert text starts with a recognisable phrase; compare kinds in order.
    const kindOf = (t: string) =>
      t.startsWith("Délai de retour") ? "return_overdue" : t.startsWith("À retourner") ? "return_soon" :
      t.startsWith("Délai pour réclamer") ? "request_overdue" : t.startsWith("Demande à envoyer") ? "request_soon" :
      t.startsWith("Il manque") ? "item_gap" : "item_late";
    expect(n.map((a) => a.kind)).toEqual(o.map(kindOf));
  });
  it("summary totals (computed like the prototype's tiles)", () => {
    const s = summary(neu, TODAY);
    const live = old.filter((c) => c.outcome !== "annule");
    const sum = (f: (c: any) => number) => live.reduce((t, c) => t + cents(f(c)), 0);
    expect(s.received).toBe(sum(P.claimReceived));
    expect(s.remaining).toBe(sum(P.claimRemaining));
    expect(s.advanced).toBe(sum((c) => c.amount));
    expect(yearlyTotals(neu, TODAY).reduce((t, y) => t + y.remaining, 0)).toBe(s.remaining);
  });
  it("merge keeps the same claims", () => {
    const half = raws.slice(0, 300).map((r) => ({ ...r, mod: r.mod + 1, label: "edited" }));
    const del = { c5: 100, c7: 0.5 };
    const o = P.mergeDocs({ claims: raws, deleted: {} }, { claims: half, deleted: del });
    const n = mergeDocs(readDoc({ claims: raws }, TODAY), readDoc({ claims: half, deleted: del }, TODAY));
    const key = (cs: { id: string; label: string }[]) => cs.map((c) => `${c.id}:${c.label}`).sort();
    expect(key(n.claims)).toEqual(key(o.claims));
  });
});
