import { describe, expect, it } from "vitest";
import { claimReceived, claimRemaining, claimStatus, isClosed, itemState, nextDue } from "../src/domain/status";
import { claim, item, shop, TODAY } from "./fixtures";

describe("item state", () => {
  const c = claim();
  it("pending before the due date, late after it", () => {
    expect(itemState(c, item({ due: TODAY }), TODAY)).toBe("pending");
    expect(itemState(c, item({ due: "2026-06-14" }), TODAY)).toBe("late");
    expect(itemState(c, item({ due: "" }), TODAY)).toBe("pending");
  });
  it("received when received >= expected (overpayment included)", () => {
    expect(itemState(c, item({ received: 1000 }), TODAY)).toBe("received");
    expect(itemState(c, item({ received: 1200 }), TODAY)).toBe("received");
  });
  it("gap when less is received, written off once accepted", () => {
    expect(itemState(c, item({ received: 700 }), TODAY)).toBe("gap");
    expect(itemState(c, item({ received: 700, writeOff: true }), TODAY)).toBe("written_off");
    // a 0 € receipt is still a receipt
    expect(itemState(c, item({ received: 0 }), TODAY)).toBe("gap");
  });
  it("refused wins over everything", () => {
    expect(itemState(c, item({ refused: true, received: 1000 }), TODAY)).toBe("refused");
  });
  it("a return not yet shipped is never late", () => {
    const s = shop();
    expect(itemState(s, item({ due: "2026-01-01" }), TODAY)).toBe("pending");
    expect(itemState({ ...s, returnedDate: "2026-06-01" }, item({ due: "2026-01-01" }), TODAY)).toBe("late");
  });
});

describe("claim status", () => {
  it("cancelled first", () => {
    expect(claimStatus(claim({ cancelled: true, items: [item({ due: "2026-01-01" })] }), TODAY)).toBe("cancelled");
  });
  it("return to ship, late once the return deadline has passed", () => {
    expect(claimStatus(shop({ returnBy: "2026-06-20" }), TODAY)).toBe("to_return");
    expect(claimStatus(shop({ returnBy: "" }), TODAY)).toBe("to_return");
    expect(claimStatus(shop({ returnBy: "2026-06-14" }), TODAY)).toBe("late");
  });
  it("late when the claim deadline has passed without sending", () => {
    const c = claim({ needsRequest: true, claimBy: "2026-06-14", items: [item({ received: 1000 })] });
    expect(claimStatus(c, TODAY)).toBe("late");
    expect(claimStatus({ ...c, sentDate: "2026-06-10" }, TODAY)).toBe("received");
  });
  it("received / refused when every line is closed", () => {
    expect(claimStatus(claim({ items: [item({ received: 1000 }), item({ received: 500, writeOff: true })] }), TODAY)).toBe("received");
    expect(claimStatus(claim({ items: [item({ received: 1000 }), item({ refused: true })] }), TODAY)).toBe("refused");
  });
  it("late before gap before to_send before partial before pending", () => {
    const late = item({ due: "2026-06-01" });
    const gapI = item({ received: 500 });
    expect(claimStatus(claim({ items: [gapI, late] }), TODAY)).toBe("late");
    expect(claimStatus(claim({ items: [gapI, item()] }), TODAY)).toBe("gap");
    expect(claimStatus(claim({ needsRequest: true, items: [item({ received: 1000 }), item()] }), TODAY)).toBe("to_send");
    expect(claimStatus(claim({ items: [item({ received: 1000 }), item()] }), TODAY)).toBe("partial");
    expect(claimStatus(claim(), TODAY)).toBe("pending");
  });
  it("a claim without lines stays pending", () => {
    expect(claimStatus(claim({ items: [] }), TODAY)).toBe("pending");
  });
  it("isClosed", () => {
    expect(isClosed(claim({ items: [item({ received: 1000 })] }), TODAY)).toBe(true);
    expect(isClosed(claim(), TODAY)).toBe(false);
    expect(isClosed(claim({ cancelled: true }), TODAY)).toBe(true);
  });
});

describe("claim amounts", () => {
  it("remaining = pending/late expected + missing part of gaps", () => {
    const c = claim({ items: [item({ expected: 1000 }), item({ expected: 2000, due: "2026-01-01" }), item({ expected: 1000, received: 300 }), item({ expected: 900, received: 100, writeOff: true }), item({ refused: true })] });
    expect(claimRemaining(c, TODAY)).toBe(1000 + 2000 + 700);
    expect(claimReceived(c)).toBe(400);
  });
  it("cancelled claims count for nothing", () => {
    const c = claim({ cancelled: true, items: [item({ received: 300 })] });
    expect(claimRemaining(c, TODAY)).toBe(0);
    expect(claimReceived(c)).toBe(0);
  });
  it("nextDue is the earliest due date among open lines", () => {
    const c = claim({ items: [item({ due: "2026-07-10" }), item({ due: "2026-07-01", received: 1000 }), item({ due: "2026-07-05" })] });
    expect(nextDue(c, TODAY)).toBe("2026-07-05");
    expect(nextDue(claim({ items: [] }), TODAY)).toBe("9999-12-31");
  });
});
