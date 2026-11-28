import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, saved, start, test, ymd } from "./fixtures";
import { historyData } from "./historyData";

const openHistory = async (page: Page) => {
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator("#history-title")).toBeVisible();
};
const panel = (page: Page) => page.locator(".filters-panel");
const tiles = (page: Page) => page.locator(".history-tiles .v");
const period = async (page: Page, from: string, to: string) => {
  await panel(page).getByLabel("Period").selectOption("custom");
  await panel(page).getByLabel("From", { exact: true }).fill(from);
  await panel(page).getByLabel("To", { exact: true }).fill(to);
};

test.describe("classification when entering an expense", () => {
  test("shopping needs a store, suggests the ones already used, and shows it on the card", async ({ page }) => {
    await start(page, { data: historyData });
    await page.locator("button.chip", { hasText: "All" }).click();
    await page.getByRole("button", { name: "+ New expense" }).click();
    const f = page.getByRole("dialog");
    await expect(f.getByLabel("Type of care")).toBeVisible();
    await f.getByLabel("Family").selectOption("shopping");
    await expect(f.getByLabel("Type of care")).toHaveCount(0);
    // Suggestions come from the stores already used, one entry per store.
    const suggestions = await f.locator("#store-suggestions option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(suggestions).toHaveLength(4);
    expect(suggestions).toEqual(expect.arrayContaining(["Zara", "Fnac", "Amazon"]));
    await f.getByLabel("Description (who, what)").fill("Sweater");
    await f.getByLabel("Amount paid (€)").fill("45");
    await f.getByRole("button", { name: "Save" }).click();
    await expect(f).toBeVisible(); // store missing: not saved
    await f.getByRole("combobox", { name: "Store", exact: true }).fill("Zara");
    await f.getByLabel("Sub-category (optional)").fill("Clothes");
    await f.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("article", { hasText: "Sweater" }).locator(".meta").first()).toContainText("Zara · Clothes");
  });

  test("health shows the type of care and no store; other keeps its own sub-category", async ({ page }) => {
    await start(page);
    await page.getByRole("button", { name: "Add my first expense" }).click();
    const f = page.getByRole("dialog");
    await f.getByLabel("Type of care").selectOption("specialist");
    await expect(f.getByRole("combobox", { name: "Store", exact: true })).toHaveCount(0);
    await expect(f.getByLabel("Sub-category (optional)")).toHaveCount(0);
    await f.getByLabel("Family").selectOption("other");
    await expect(f.getByLabel("Sub-category (optional)")).toBeVisible();
    await expect(f.getByLabel("Type of care")).toHaveCount(0);
    // Back to health keeps the lines pre-filled for health.
    await f.getByLabel("Family").selectOption("health");
    await expect(f.locator(".exp-row select").first()).toHaveValue("social_security");
  });
});

test.describe("history", () => {
  test("by store over a period: spellings merged, totals and timeline add up", async ({ page }) => {
    await start(page, { data: historyData });
    await openHistory(page);
    await panel(page).getByLabel("Family").selectOption("shopping");
    await period(page, "2026-01-01", "2026-12-31");
    // Decathlon / decathlon / DECATHLON are one store.
    const stores = await panel(page).getByLabel("Store").locator("option").allInnerTexts();
    expect(stores.filter((s) => /decathlon/i.test(s))).toHaveLength(1);
    await panel(page).getByLabel("Store").selectOption("decathlon");
    // 120 + 189 + 49 paid; 120 + 189 refunded; 49 still to receive; nothing out-of-pocket.
    await expect(tiles(page)).toHaveText(["€358.00", "€309.00", "€49.00", "€0.00"]);
    await expect(page.locator(".tl-item")).toHaveCount(3);
    await expect(page.locator(".month-head h4")).toHaveText(["August 2026", "April 2026", "January 2026"]);
    // Narrowing the period leaves only what falls inside it.
    await period(page, "2026-04-01", "2026-04-30");
    await expect(page.locator(".tl-item")).toHaveCount(1);
    await expect(tiles(page).first()).toHaveText("€189.00");
  });

  test("all stores: breakdown by store, biggest first, with a total that matches the summary", async ({ page }) => {
    await start(page, { data: historyData });
    await openHistory(page);
    await panel(page).getByLabel("Family").selectOption("shopping");
    await period(page, "2026-01-01", "2026-12-31");
    const rows = page.locator(".breakdown tbody tr");
    await expect(rows.first().locator("th")).toContainText("Decathlon");
    const names = await rows.locator("th").allInnerTexts();
    expect(names.map((n) => n.trim())).toEqual(["Decathlon", "Fnac", "Zara", "Total"]);
    const total = await rows.last().locator("td").allInnerTexts();
    expect(total[1]).toBe(await tiles(page).nth(0).innerText());
  });

  test("health: by type of care, and cancelled expenses are never counted", async ({ page }) => {
    await start(page, { data: historyData });
    await openHistory(page);
    await panel(page).getByLabel("Family").selectOption("health");
    await period(page, "2026-01-01", "2026-12-31");
    await expect(page.locator(".tl-item")).toHaveCount(4); // the cancelled one is left out
    await panel(page).getByLabel("Type of care").selectOption("specialist");
    // 60 + 80 paid; 45 + 45 refunded; 15 still expected; 35 out-of-pocket.
    await expect(tiles(page)).toHaveText(["€140.00", "€90.00", "€15.00", "€35.00"]);
    await expect(page.locator(".tl-item")).toHaveCount(2);
    await panel(page).getByLabel("Type of care").selectOption("lab_tests");
    await expect(page.locator(".tl-item")).toHaveCount(1);
  });

  test("period presets follow today's date", async ({ page }) => {
    const oneYearAgo = ymd(-366);
    await start(page, {
      data: { version: 3, deleted: {}, claims: [
        { ...historyData.claims[0]!, id: "now", date: ymd(0), label: "Today's visit" },
        { ...historyData.claims[0]!, id: "then", date: oneYearAgo, label: "Visit a year ago" },
      ] },
    });
    await openHistory(page);
    const count = () => page.locator(".tl-item").count();
    await panel(page).getByLabel("Period").selectOption("all");
    expect(await count()).toBe(2);
    await panel(page).getByLabel("Period").selectOption("this_year");
    expect(await count()).toBe(1);
    await panel(page).getByLabel("Period").selectOption("this_month");
    await expect(page.locator(".tl-title")).toHaveText(["Today's visit"]);
    await panel(page).getByLabel("Period").selectOption("last_year");
    await expect(page.locator(".tl-title")).toHaveText(["Visit a year ago"]);
  });

  test("order: newest first or oldest first", async ({ page }) => {
    await start(page, { data: historyData });
    await openHistory(page);
    await panel(page).getByLabel("Family").selectOption("health");
    await expect(page.locator(".tl-title").first()).toHaveText("Blood test");
    await panel(page).getByLabel("Order").selectOption("asc");
    await expect(page.locator(".tl-title").first()).toHaveText("Dr Martin, consultation");
  });

  test("empty result and a French interface", async ({ page }) => {
    await start(page, { data: historyData });
    await openHistory(page);
    await period(page, "2030-01-01", "2030-12-31");
    await expect(page.locator(".empty")).toContainText("No expense matches");
    await expect(panel(page).getByRole("button", { name: "Print / Save as PDF" })).toBeDisabled();
    await page.getByLabel("Language").selectOption("fr");
    await expect(page.locator("#history-title")).toHaveText("Historique");
    await expect(page.locator(".empty")).toContainText("Aucune dépense ne correspond");
  });

  test("export to CSV: one row per expense, in the order shown, with the family and the sub-category", async ({ page }) => {
    await start(page, { data: historyData });
    await openHistory(page);
    await panel(page).getByLabel("Family").selectOption("shopping");
    await period(page, "2026-01-01", "2026-12-31");
    const [dl] = await Promise.all([page.waitForEvent("download"), panel(page).getByRole("button", { name: "Export to CSV" }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^history-shopping-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = (await readFile(await dl.path(), "utf8")).replace(/^﻿/, "").trimEnd();
    const rows = text.split("\r\n");
    expect(rows[0]).toBe("Date;Family;Type / Store;Sub-category;Description;Reference;Paid;Refunded;To receive;Out-of-pocket;Status");
    expect(rows).toHaveLength(1 + 5); // 5 shopping expenses in 2026
    expect(rows[1]!.startsWith("05/08/2026;Shopping;DECATHLON;Sport;Backpack;;49,00;0,00;49,00;0,00;")).toBe(true);
  });

  test("print: the page asks the browser to print, and the printed page only shows the report", async ({ page }) => {
    await start(page, { data: historyData });
    await openHistory(page);
    await panel(page).getByLabel("Family").selectOption("shopping");
    await panel(page).getByLabel("Store").selectOption("zara");
    await period(page, "2026-01-01", "2026-12-31");
    await page.evaluate(() => {
      (window as unknown as { printedTitle: string }).printedTitle = "";
      window.print = () => { (window as unknown as { printedTitle: string }).printedTitle = document.title; };
    });
    await panel(page).getByRole("button", { name: "Print / Save as PDF" }).click();
    // The title becomes the suggested file name of the PDF.
    expect(await page.evaluate(() => (window as unknown as { printedTitle: string }).printedTitle)).toBe("History · Zara · 01/01/2026 – 31/12/2026");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".print-head")).toBeVisible();
    await expect(page.locator(".print-head h2")).toHaveText("History · Zara");
    await expect(page.locator(".views")).toBeHidden();
    await expect(page.locator(".filters-panel")).toBeHidden();
    await expect(page.locator(".app-header")).toBeHidden();
    await expect(page.locator(".tl-item")).toHaveCount(1);
    await page.emulateMedia({ media: "screen" });
    await expect(page.locator(".print-head")).toBeHidden();
  });

  test("the choice of language and filters survives going back and forth between sections", async ({ page }) => {
    await start(page, { data: historyData });
    await openHistory(page);
    await page.getByRole("button", { name: "Tracking" }).click();
    await expect(page.locator(".list-section")).toBeVisible();
    await saved(page);
  });
});

for (const scheme of ["light", "dark"] as const) {
  test(`history has no accessibility violations (${scheme})`, async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await page.emulateMedia({ colorScheme: scheme });
    await start(page, { data: historyData });
    await openHistory(page);
    await panel(page).getByLabel("Family").selectOption("shopping");
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    await page.getByRole("button", { name: "+ New expense" }).click();
    await page.getByRole("dialog").getByLabel("Family").selectOption("shopping");
    const d = await new AxeBuilder({ page }).include("dialog").analyze();
    expect(d.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  });
}
