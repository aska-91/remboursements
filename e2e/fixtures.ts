import { expect, test as base, type Page } from "@playwright/test";

/** Date in Europe/Paris, `n` days from today, as YYYY-MM-DD. */
export function ymd(n: number): string {
  const d = new Date(Date.now() + n * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}
const t = (n: number) => Date.now() + n * 86_400_000;

/** Sample data in the prototype's format (taken over on first start), covering every status. */
export function demoData() {
  return {
    v: 2, deleted: {},
    claims: [
      { id: "d1", date: ymd(-40), label: "Dr Martin, consultation", cat: "Médecin généraliste", amount: 30, ref: "FS-2231", mod: t(-40),
        log: [{ t: t(-40), text: "Dépense créée" }],
        items: [{ id: "d1a", source: "Sécurité sociale", expected: 20, due: ymd(-33), received: 20, receivedDate: ymd(-34) },
                { id: "d1b", source: "Mutuelle", expected: 9, due: ymd(-12) }] },
      { id: "d2", date: ymd(-20), label: "Coat, online shop", cat: "Retour d'article", amount: 89.99, returnBy: ymd(4), mod: t(-20),
        log: [], items: [{ id: "d2a", source: "Enseigne", expected: 89.99, due: "" }] },
      { id: "d3", date: ymd(-25), label: "Glasses", cat: "Dentiste / Optique", amount: 349, mod: t(-5), log: [],
        items: [{ id: "d3a", source: "Sécurité sociale", expected: 12.5, due: ymd(-18), received: 12.5, receivedDate: ymd(-17) },
                { id: "d3b", source: "Mutuelle", expected: 150, due: ymd(-11), received: 60, receivedDate: ymd(-5) }] },
      { id: "d4", date: ymd(-3), label: "Blood test", cat: "Examens / Analyses", amount: 42.6, needsRequest: true, claimBy: ymd(20), mod: t(-3), log: [],
        items: [{ id: "d4a", source: "Sécurité sociale", expected: 25.56, due: ymd(4) }, { id: "d4b", source: "Mutuelle", expected: 17.04, due: ymd(11) }] },
      { id: "d5", date: ymd(-60), label: "Pharmacy, prescription", cat: "Pharmacie", amount: 18.4, mod: t(-50), log: [],
        items: [{ id: "d5a", source: "Sécurité sociale", expected: 12, due: ymd(-53), received: 12, receivedDate: ymd(-52) },
                { id: "d5b", source: "Mutuelle", expected: 6.4, due: ymd(-46), received: 6.4, receivedDate: ymd(-50) }] },
      { id: "d6", date: ymd(-15), label: "Running shoes", cat: "Retour d'article", amount: 120, returnBy: ymd(-1), mod: t(-15), log: [],
        items: [{ id: "d6a", source: "Enseigne", expected: 120, due: "" }] },
      { id: "d7", date: ymd(-90), label: "Osteopath", cat: "Médecin spécialiste", amount: 60, mod: t(-70), log: [],
        items: [{ id: "d7a", source: "Mutuelle", expected: 25, due: ymd(-76), refused: true, refusedReason: "Not covered" }] },
      { id: "d8", date: ymd(-10), label: "Duplicate entry", cat: "Pharmacie", amount: 9, outcome: "annule", mod: t(-9),
        log: [{ t: t(-9), text: "Dépense annulée : doublon" }], items: [{ id: "d8a", source: "Sécurité sociale", expected: 6, due: ymd(-3) }] },
    ],
  };
}

/** Starts from a clean device, optionally with the sample data. */
export async function start(page: Page, opts: { demo?: boolean; data?: unknown } = {}) {
  await page.goto("/");
  await page.evaluate(async (data) => {
    localStorage.clear();
    await new Promise((r) => { const q = indexedDB.deleteDatabase("refund-tracker"); q.onsuccess = q.onerror = q.onblocked = r; });
    if (data) localStorage.setItem("remboursements-v2", JSON.stringify(data));
  }, opts.data ?? (opts.demo ? demoData() : null));
  await page.reload();
  await page.locator(opts.data ? ".chip" : opts.demo ? ".card" : ".empty").first().waitFor();
}

/** Waits until every change has been written to the device (before a reload). */
export async function saved(page: Page) {
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-saving"));
}

/** Fails the test on any uncaught page error. */
export const test = base.extend<{ errors: string[] }>({
  errors: [async ({ page, browser }, use, testInfo) => {
    const errors: string[] = [];
    // Timeline of what the page did, printed only when a test fails (to diagnose CI-only failures).
    const t0 = Date.now();
    const events: string[] = [];
    const note = (e: string) => events.push(`+${Date.now() - t0}ms ${e}`);
    page.on("pageerror", (e) => { errors.push(String(e)); note(`pageerror ${e}`); });
    page.on("crash", () => { errors.push("page crashed"); note("CRASH"); });
    page.on("close", () => note("page closed"));
    page.on("console", (m) => { note(`console.${m.type()} ${m.text()}`); if (m.type() === "error") errors.push(`console: ${m.text()}`); });
    page.on("framenavigated", (f) => { if (f === page.mainFrame()) note(`navigated ${f.url()}`); });
    browser.on("disconnected", () => note("BROWSER DISCONNECTED"));
    await use(errors);
    if (testInfo.status !== testInfo.expectedStatus) console.log(`--- timeline of "${testInfo.title}" (${testInfo.project.name}) ---\n${events.join("\n")}`);
    expect(errors).toEqual([]);
  }, { auto: true }],
});
export { expect };
