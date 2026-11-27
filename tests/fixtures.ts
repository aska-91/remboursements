import type { Claim, Item } from "../src/domain/types";

export const TODAY = "2026-06-15";
export const NOW = Date.UTC(2026, 5, 15, 10, 0);

let n = 0;
export function item(p: Partial<Item> = {}): Item {
  return {
    id: `i${++n}`, source: "social_security", expected: 1000, due: "2026-06-30", received: null,
    receivedDate: "", writeOff: false, refused: false, refusedReason: "", lastChase: "", ...p,
  };
}

export function claim(p: Partial<Claim> = {}): Claim {
  return {
    id: `c${++n}`, date: "2026-06-01", label: "Visit", category: "gp", amount: 3000, ref: "", notes: "",
    archived: false, cancelled: false, returnBy: "", returnedDate: "", tracking: "", refundMode: "original_payment",
    needsRequest: false, claimBy: "", sentDate: "", log: [], mod: 1, items: [item()], ...p,
  };
}

export function shop(p: Partial<Claim> = {}): Claim {
  return claim({ category: "item_return", label: "Shoes", items: [item({ source: "retailer", expected: 3000, due: "" })], ...p });
}
