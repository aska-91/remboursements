/** Fixed data (current format, amounts in cents) for the history tests. Dates are in 2026. */
let n = 0;
const it = (source: string, expected: number, p: Record<string, unknown> = {}) => ({
  id: `i${++n}`, source, expected, due: "", received: null, receivedDate: "", writeOff: false, refused: false, refusedReason: "", lastChase: "", ...p,
});
const base = { ref: "", notes: "", archived: false, cancelled: false, returnBy: "", returnedDate: "", tracking: "", refundMode: "original_payment", needsRequest: false, claimBy: "", sentDate: "", log: [], mod: 1_760_000_000_000 };
const shop = (id: string, date: string, label: string, store: string, subcategory: string, amount: number, received: number | null) => ({
  ...base, id, date, label, category: "item_return", store, subcategory, amount, returnedDate: date,
  items: [it("retailer", amount, { due: date, received, receivedDate: received == null ? "" : date })],
});
const care = (id: string, date: string, label: string, category: string, amount: number, ss: [number, number | null], mu: [number, number | null]) => ({
  ...base, id, date, label, category, store: "", subcategory: "", amount,
  items: [
    it("social_security", ss[0], { due: date, received: ss[1], receivedDate: ss[1] == null ? "" : date }),
    it("mutuelle", mu[0], { due: date, received: mu[1], receivedDate: mu[1] == null ? "" : date }),
  ],
});

export const historyData = {
  version: 3, deleted: {},
  claims: [
    care("h1", "2026-01-12", "Dr Martin, consultation", "gp", 3000, [2000, 2000], [900, 900]),
    care("h2", "2026-02-03", "Dr Leroy, dermatologist", "specialist", 6000, [2500, 2500], [2000, 2000]),
    care("h3", "2026-03-18", "Dr Petit, cardiologist", "specialist", 8000, [3000, 3000], [3000, 1500]),
    care("h4", "2026-04-02", "Blood test", "lab_tests", 4260, [2556, 2556], [1704, 1704]),
    shop("s1", "2026-01-20", "Running shoes", "Decathlon", "Sport", 12000, 12000),
    shop("s2", "2026-04-11", "Tent", "decathlon", "Sport", 18900, 18900),
    shop("s3", "2026-08-05", "Backpack", "DECATHLON", "Sport", 4900, null),
    shop("s4", "2026-03-01", "Jacket", "Zara", "Clothes", 7990, 7990),
    shop("s5", "2025-12-09", "Gift", "Amazon", "", 3500, 3500),
    shop("s6", "2026-05-07", "Headphones", "Fnac", "Electronics", 15900, 15900),
    { ...base, id: "o1", date: "2026-07-04", label: "Vet", category: "other", store: "", subcategory: "Pets", amount: 6000, items: [it("other", 3000, { received: 3000, receivedDate: "2026-07-04" })] },
    { ...base, id: "x1", date: "2026-05-01", label: "Cancelled", category: "gp", store: "", subcategory: "", amount: 9900, cancelled: true, items: [] },
  ],
};
