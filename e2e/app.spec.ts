import { expect, saved, start, test, ymd } from "./fixtures";

const fmt = (s: string) => s.split("-").reverse().join("/");

test("shows every expense, overview and to-do, without horizontal scroll", async ({ page }) => {
  await start(page, { demo: true });
  await page.getByRole("button", { name: /^All/ }).click();
  await expect(page.locator(".card")).toHaveCount(8);
  await expect(page.locator(".tile .v").first()).toHaveText("€351.59");
  await expect(page.locator(".alert")).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("makes no request outside the app", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (r) => { if (!r.url().startsWith("http://localhost:4175")) outside.push(r.url()); });
  await start(page, { demo: true });
  expect(outside).toEqual([]);
});

test("partial receipt, gap accepted, archive, then delete with confirmation", async ({ page }) => {
  await start(page, { demo: true });
  await page.getByRole("button", { name: /^All/ }).click();
  const card = page.locator("article", { hasText: "Dr Martin" });
  await card.getByRole("button", { name: "Mark received" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Amount received (€)").fill("5");
  await expect(dlg.getByText("€4.00 will still be missing")).toBeVisible();
  await dlg.getByRole("button", { name: "OK" }).click();
  await expect(card.locator(".pill").first()).toHaveText("Gap to chase");
  await card.getByRole("button", { name: "Out-of-pocket" }).click();
  await expect(card.locator(".pill").first()).toHaveText("Received");
  await card.getByRole("button", { name: "Archive" }).click();
  await page.locator("button.chip", { hasText: "Archive" }).click();
  const archived = page.locator("article", { hasText: "Dr Martin" });
  await archived.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await archived.getByRole("button", { name: "Delete permanently" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".card")).toHaveCount(0);
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: /^All/ }).click();
  await expect(page.locator("article", { hasText: "Dr Martin" })).toHaveCount(0);
});

test("a zero receipt is refused by the form", async ({ page }) => {
  await start(page, { demo: true });
  await page.locator("article", { hasText: "Dr Martin" }).getByRole("button", { name: "Mark received" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Amount received (€)").fill("0");
  await dlg.getByRole("button", { name: "OK" }).click();
  await expect(dlg).toBeVisible();
});

test("return: the refund date follows the return date (+14 days)", async ({ page }) => {
  await start(page, { demo: true });
  await page.locator("article", { hasText: "Running shoes" }).getByRole("button", { name: "Mark as returned" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByLabel("Refund expected by")).toHaveValue(ymd(14));
  await dlg.getByLabel("Return date").fill(ymd(-3));
  await expect(dlg.getByLabel("Refund expected by")).toHaveValue(ymd(11));
  await dlg.getByRole("button", { name: "Save return" }).click();
  await expect(page.locator("article", { hasText: "Running shoes" }).locator(".item .when")).toContainText(fmt(ymd(11)));
});

test("new expense with pre-filled lines; locked lines cannot be removed when editing", async ({ page }) => {
  await start(page);
  await page.locator("button.chip", { hasText: "All" }).click();
  await page.getByRole("button", { name: "Add my first expense" }).click();
  const f = page.getByRole("dialog");
  await expect(f.locator(".exp-row select")).toHaveCount(2);
  await expect(f.getByLabel("Refund line 1").getByLabel("Expected date")).toHaveValue(ymd(7));
  await expect(f.getByLabel("Refund line 2").getByLabel("Expected date")).toHaveValue(ymd(14));
  await f.getByLabel("Description (who, what)").fill("Dr Durand");
  await f.getByLabel("Amount paid (€)").fill("50");
  await f.getByLabel("Refund line 1").getByLabel("Expected amount (€)").fill("30");
  await f.getByRole("button", { name: "Save" }).click();
  const card = page.locator("article", { hasText: "Dr Durand" });
  await expect(card.locator(".item").nth(1)).toContainText("Amount not set");
  await card.getByRole("button", { name: "Mark received" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "OK" }).click();
  await card.getByRole("button", { name: "Edit" }).click();
  const e = page.getByRole("dialog");
  await expect(e.getByLabel("Refund line 1").getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(e.getByLabel("Refund line 1")).toContainText("cannot be removed");
  await e.getByLabel("Refund line 2").getByRole("button", { name: "Remove" }).click();
  await e.getByRole("button", { name: "Save" }).click();
  await card.locator("summary").click();
  await expect(card.locator(".logrow").first()).toContainText("line removed: Mutuelle");
});

test("backup: import asks first, merges once, rejects bad files; CSV export", async ({ page }, info) => {
  await start(page, { demo: true });
  // Export the data, then import it into a clean device.
  await page.locator("summary", { hasText: "Backup" }).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export a full backup" }).click()]);
  const backup = info.outputPath("backup.json");
  await dl.saveAs(backup);
  await page.locator("summary", { hasText: "Backup" }).click();
  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export to CSV (spreadsheet)" }).click()]);
  const text = await (await import("node:fs/promises")).readFile(await csv.path(), "utf8");
  expect(text.replace(/^﻿/, "").trimEnd().split("\r\n")).toHaveLength(13);

  await start(page);
  const importFile = async (path: string) => {
    await page.locator("summary", { hasText: "Backup" }).click();
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Import a backup" }).click()]);
    await chooser.setFiles(path);
  };
  await importFile(backup);
  await expect(page.getByRole("dialog")).toContainText("Merge the 8 expenses");
  await page.getByRole("dialog").getByRole("button", { name: "Import" }).click();
  await expect(page.locator(".toast")).toHaveText("Backup imported: 8 expenses added");
  await importFile(backup);
  await page.getByRole("dialog").getByRole("button", { name: "Import" }).click();
  await expect(page.locator(".toast")).toHaveText("Backup imported: nothing new");
  const bad = info.outputPath("bad.json");
  await (await import("node:fs/promises")).writeFile(bad, "{not json");
  await importFile(bad);
  await expect(page.locator(".toast")).toHaveText("This file is not a valid backup");
});

test("French: switch, remembered after reload, journal in French", async ({ page }) => {
  await start(page, { demo: true });
  await page.getByLabel("Language").selectOption("fr");
  await expect(page.locator("h1")).toHaveText("Mes remboursements");
  await page.locator("button.chip", { hasText: "Tous" }).click();
  await expect(page.locator(".tile .v").first()).toHaveText("351,59 €");
  const card = page.locator("article", { hasText: "Dr Martin" });
  await card.getByRole("button", { name: "Marquer reçu" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Valider" }).click();
  await card.locator("summary").click();
  await expect(card.locator(".logrow").first()).toContainText("Reçu 9,00 € de Mutuelle");
  await saved(page);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("h1")).toHaveText("Mes remboursements");
});

test("works offline once loaded", async ({ page, context }) => {
  await start(page, { demo: true });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready.then(() => true));
  await saved(page);
  await page.reload(); // now controlled by the service worker
  await page.locator(".card").first().waitFor();
  await context.setOffline(true);
  await saved(page);
  await page.reload();
  await expect(page.locator(".card").first()).toBeVisible();
  await context.setOffline(false);
});

test("Chrome reports the app as installable (manifest, icons, service worker)", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "installability check is Chromium-only");
  await start(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of manifest.icons) expect((await page.request.get(`/${icon.src}`)).ok()).toBe(true);
});

for (const scheme of ["light", "dark"] as const) {
  test(`no accessibility violations (axe, ${scheme} theme, list and dialog)`, async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await page.emulateMedia({ colorScheme: scheme });
    await start(page, { demo: true });
    await page.locator("button.chip", { hasText: "All" }).click();
    await page.locator(".yearly summary").click();
    const list = await new AxeBuilder({ page }).analyze();
    expect(list.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    await page.getByRole("button", { name: "+ New expense" }).click();
    const dialog = await new AxeBuilder({ page }).include("dialog").analyze();
    expect(dialog.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  });
}
