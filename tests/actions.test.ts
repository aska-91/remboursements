import { describe, expect, it } from "vitest";
import * as A from "../src/domain/actions";
import { claimStatus, itemState } from "../src/domain/status";
import type { ClaimInput } from "../src/domain/actions";
import { claim, item, NOW, shop, TODAY } from "./fixtures";

const later = NOW + 60_000;

function input(p: Partial<ClaimInput> = {}): ClaimInput {
  return {
    date: TODAY, label: " Dr Martin ", category: "gp", amount: 3000, ref: "", notes: "", returnBy: "", returnedDate: "",
    tracking: "", refundMode: "original_payment", needsRequest: false, claimBy: "", sentDate: "",
    items: A.defaultItems("gp", TODAY, 3000), ...p,
  };
}

describe("form defaults", () => {
  it("health: Sécurité sociale (+7 days) and Mutuelle (+14 days)", () => {
    expect(A.defaultItems("gp", "2026-06-15", 3000).map((i) => [i.source, i.due, i.expected])).toEqual([
      ["social_security", "2026-06-22", 0], ["mutuelle", "2026-06-29", 0],
    ]);
  });
  it("return: one Retailer line for the full amount, no date until shipped", () => {
    expect(A.defaultItems("item_return", "2026-06-15", 4999).map((i) => [i.source, i.due, i.expected])).toEqual([["retailer", "", 4999]]);
  });
  it("claim deadline: date + 2 years; refund after return: + 14 days", () => {
    expect(A.defaultClaimBy("2026-06-15")).toBe("2028-06-15");
    expect(A.defaultClaimBy("2028-02-29")).toBe("2030-03-01");
    expect(A.defaultRefundDue("2026-12-25")).toBe("2027-01-08");
  });
});

describe("create and edit", () => {
  it("creates a trimmed claim with a journal entry", () => {
    const c = A.createClaim(input(), NOW);
    expect(c.label).toBe("Dr Martin");
    expect(c.mod).toBe(NOW);
    expect(c.log).toEqual([{ t: NOW, text: "Expense created: €30.00 advanced" }]);
  });
  it("requires a label", () => {
    expect(() => A.createClaim(input({ label: "  " }), NOW)).toThrow();
  });
  it("drops fields that do not belong to the category", () => {
    const h = A.createClaim(input({ returnBy: "2026-07-01", tracking: "X", needsRequest: true, claimBy: "2028-06-15" }), NOW);
    expect([h.returnBy, h.tracking, h.claimBy]).toEqual(["", "", "2028-06-15"]);
    const s = A.createClaim(input({ category: "item_return", needsRequest: true, claimBy: "2028-06-15", sentDate: "2026-06-01" }), NOW);
    expect([s.needsRequest, s.claimBy, s.sentDate]).toEqual([false, "", ""]);
    const h2 = A.createClaim(input({ needsRequest: false, claimBy: "2028-06-15" }), NOW);
    expect(h2.claimBy).toBe("");
  });
  it("a return entered as already shipped gets refund date = return + 14 days", () => {
    const s = A.createClaim(input({ category: "item_return", returnedDate: "2026-06-10", items: A.defaultItems("item_return", TODAY, 3000) }), NOW);
    expect(s.items[0]!.due).toBe("2026-06-24");
  });
  it("a line with a receipt or a refusal cannot be removed; removed lines are logged", () => {
    const c = claim({ items: [item({ id: "paid", received: 500 }), item({ id: "ref", refused: true }), item({ id: "open", source: "mutuelle", expected: 900 })] });
    const keep = (ids: string[]) => input({ items: c.items.filter((i) => ids.includes(i.id)).map((i) => ({ id: i.id, source: i.source, expected: i.expected, due: i.due })) });
    expect(() => A.editClaim(c, keep(["ref", "open"]), later)).toThrow();
    expect(() => A.editClaim(c, keep(["paid", "open"]), later)).toThrow();
    const e = A.editClaim(c, keep(["paid", "ref"]), later);
    expect(e.items.map((i) => i.id)).toEqual(["paid", "ref"]);
    expect(e.log.at(-1)!.text).toBe("Expense edited · line removed: Mutuelle €9.00");
    expect(A.isLocked(c.items[0]!)).toBe(true);
    expect(A.isLocked(c.items[2]!)).toBe(false);
  });
  it("editing keeps receipts and refusals of existing lines", () => {
    const c = claim({ items: [item({ id: "a", received: 400, receivedDate: "2026-06-05" })] });
    const e = A.editClaim(c, input({ items: [{ id: "a", source: "mutuelle", expected: 900, due: "2026-07-01" }] }), later);
    expect(e.items[0]).toMatchObject({ source: "mutuelle", expected: 900, received: 400, receivedDate: "2026-06-05" });
    expect(e.log.at(-1)!.text).toBe("Expense edited");
  });
});

describe("refund lines", () => {
  const base = claim({ items: [item({ id: "a", expected: 1000, source: "mutuelle" })] });

  it("full receipt", () => {
    const c = A.recordReceipt(base, "a", 1000, "2026-06-15", false, later);
    expect(itemState(c, c.items[0]!, TODAY)).toBe("received");
    expect(c.log.at(-1)).toEqual({ t: later, text: "Received €10.00 from Mutuelle on 15/06/2026" });
    expect(base.items[0]!.received).toBeNull(); // input untouched
  });
  it("partial receipt left to chase, then a top-up is cumulated", () => {
    const c1 = A.recordReceipt(base, "a", 600, "2026-06-15", false, later);
    expect(itemState(c1, c1.items[0]!, TODAY)).toBe("gap");
    expect(c1.log.at(-1)!.text).toBe("Received €6.00 from Mutuelle on 15/06/2026: gap of €4.00 to chase");
    expect(A.suggestedReceipt(c1.items[0]!)).toBe(400);
    const c2 = A.recordReceipt(c1, "a", 400, "2026-06-20", false, later);
    expect(c2.items[0]).toMatchObject({ received: 1000, receivedDate: "2026-06-20" });
    expect(itemState(c2, c2.items[0]!, TODAY)).toBe("received");
  });
  it("partial receipt accepted as out-of-pocket, then reopened", () => {
    expect(A.gapAfterReceipt(base.items[0]!, 700)).toBe(300);
    const c = A.recordReceipt(base, "a", 700, "2026-06-15", true, later);
    expect(itemState(c, c.items[0]!, TODAY)).toBe("written_off");
    expect(c.log.at(-1)!.text).toContain("accepted as out-of-pocket");
    const r = A.reopenGap(c, "a", later);
    expect(itemState(r, r.items[0]!, TODAY)).toBe("gap");
  });
  it("write-off is ignored when nothing is missing", () => {
    const c = A.recordReceipt(base, "a", 1000, "2026-06-15", true, later);
    expect(c.items[0]!.writeOff).toBe(false);
  });
  it("gap accepted later from the to-do list", () => {
    const c = A.writeOffGap(A.recordReceipt(base, "a", 250, TODAY, false, later), "a", later);
    expect(c.log.at(-1)!.text).toBe("Missing €7.50 (Mutuelle) accepted as out-of-pocket");
  });
  it("undo receipt", () => {
    const c = A.undoReceipt(A.recordReceipt(base, "a", 250, TODAY, true, later), "a", later);
    expect(c.items[0]).toMatchObject({ received: null, receivedDate: "", writeOff: false });
  });
  it("chase: records the date and an optional new expected date", () => {
    const c = A.recordChase(base, "a", "2026-06-15", " phoned ", "2026-07-01", later);
    expect(c.items[0]).toMatchObject({ lastChase: "2026-06-15", due: "2026-07-01" });
    expect(c.log.at(-1)!.text).toBe("Chased Mutuelle on 15/06/2026: phoned · new expected date 01/07/2026");
    expect(A.recordChase(base, "a", TODAY, "", "", later).items[0]!.due).toBe(base.items[0]!.due);
  });
  it("refuse needs a reason; can be undone", () => {
    expect(() => A.refuseItem(base, "a", " ", later)).toThrow();
    const c = A.refuseItem(base, "a", "Not covered", later);
    expect(claimStatus(c, TODAY)).toBe("refused");
    expect(claimStatus(A.undoRefusal(c, "a", later), TODAY)).toBe("pending");
  });
  it("a receipt must be more than 0", () => {
    expect(() => A.recordReceipt(base, "a", 0, TODAY, false, later)).toThrow();
    expect(() => A.recordReceipt(base, "a", -100, TODAY, false, later)).toThrow();
  });
  it("unknown line id throws", () => {
    expect(() => A.recordReceipt(base, "nope", 1, TODAY, false, later)).toThrow();
  });
});

describe("claim steps", () => {
  it("mark a return as shipped: open lines get the refund date", () => {
    const s = shop({ items: [item({ id: "a", due: "" }), item({ id: "b", received: 100 }), item({ id: "c", refused: true, due: "" })] });
    const r = A.markReturned(s, "2026-06-15", "TRK1", "2026-06-29", later);
    expect(r.items.map((i) => i.due)).toEqual(["2026-06-29", s.items[1]!.due, ""]);
    expect(r.tracking).toBe("TRK1");
    expect(r.log.at(-1)!.text).toBe("Item returned on 15/06/2026 · tracking TRK1 · refund expected by 29/06/2026");
  });
  it("request sent", () => {
    const c = A.markSent(claim({ needsRequest: true }), "2026-06-15", "Ameli app", later);
    expect(c.sentDate).toBe("2026-06-15");
    expect(c.log.at(-1)!.text).toBe("Request sent on 15/06/2026 (Ameli app)");
  });
  it("cancel needs a reason, keeps history, can be restored", () => {
    expect(() => A.cancelClaim(claim(), "", later)).toThrow();
    const c = A.cancelClaim(claim(), "Duplicate", later);
    expect(claimStatus(c, TODAY)).toBe("cancelled");
    expect(A.lastCancelReason(c)).toBe("Duplicate");
    expect(claimStatus(A.restoreClaim(c, later), TODAY)).toBe("pending");
  });
  it("finds the reason in prototype (French) journal entries too", () => {
    expect(A.lastCancelReason(claim({ log: [{ t: 1, text: "Dépense annulée : doublon" }] }))).toBe("doublon");
  });
  it("note", () => {
    expect(A.addNote(claim(), "2026-06-15", "Called", later).log.at(-1)!.text).toBe("15/06/2026: Called");
    expect(() => A.addNote(claim(), TODAY, " ", later)).toThrow();
  });
});

describe("archive and delete", () => {
  it("only closed claims can be archived", () => {
    expect(() => A.archiveClaim(claim(), TODAY, later)).toThrow();
    const done = claim({ items: [item({ received: 1000 })] });
    const a = A.archiveClaim(done, TODAY, later);
    expect(a.archived).toBe(true);
    expect(A.unarchiveClaim(a, later).archived).toBe(false);
  });
  it("only archived claims can be deleted; deletion is tracked", () => {
    const live = claim({ id: "live" });
    const arch = claim({ id: "arch", archived: true });
    const doc = { version: 3 as const, claims: [live, arch], deleted: {} };
    expect(() => A.deleteClaim(doc, "live", later)).toThrow();
    const d = A.deleteClaim(doc, "arch", later);
    expect(d.claims.map((c) => c.id)).toEqual(["live"]);
    expect(d.deleted).toEqual({ arch: later });
  });
});
