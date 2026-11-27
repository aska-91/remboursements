import type { Page } from "@playwright/test";
import { expect, start, test } from "./fixtures";

/** Replaces the native file picker with a file in the browser's private file system (same API). */
async function fakePicker(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { showSaveFilePicker: () => Promise<FileSystemFileHandle> }).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle("autosave.json", { create: true });
  });
}
const readFile = (page: Page) =>
  page.evaluate(async () => {
    const h = await (await navigator.storage.getDirectory()).getFileHandle("autosave.json", { create: true });
    return (await h.getFile()).text();
  });
const writeFile = (page: Page, text: string) =>
  page.evaluate(async (t) => {
    const h = await (await navigator.storage.getDirectory()).getFileHandle("autosave.json", { create: true });
    const w = await h.createWritable();
    await w.write(t);
    await w.close();
  }, text);
const openMenu = (page: Page) => page.locator("summary", { hasText: "Backup" }).click();

/*
 * The browser's private file system stands in for a file picked on disk (tests cannot drive the
 * native picker). Restarting is not tested here: on GitHub's Ubuntu runners, reading such a handle
 * back from IndexedDB after a reload makes Chromium exit (seen with plain code, without the app).
 * Real installs store a handle to a file on disk, a different path. Restart behaviour (resume with
 * or without permission) is covered by tests/fileMirror.test.ts.
 */
test("saves to the chosen file after every change, and stops when asked", async ({ page }) => {
  await fakePicker(page);
  await start(page, { demo: true });
  await writeFile(page, "");
  await openMenu(page);
  await page.getByRole("button", { name: "Save automatically to a file…" }).click();
  await expect(page.locator(".toast")).toHaveText("Automatic saving to “autosave.json” started");
  await expect.poll(async () => JSON.parse((await readFile(page)) || "{}").claims?.length).toBe(8);
  await openMenu(page);
  await expect(page.locator(".menu-section [role=status]")).toContainText("Saving to “autosave.json”");
  await page.keyboard.press("Escape");

  // Each change reaches the file shortly after.
  const card = page.locator("article", { hasText: "Dr Martin" });
  for (const note of ["Called the mutuelle", "Second note"]) {
    await card.getByRole("button", { name: "Add note" }).click();
    await page.getByRole("dialog").getByLabel("Note").fill(note);
    await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
    await expect.poll(() => readFile(page), { timeout: 5000 }).toContain(note);
  }

  // Stop: the file no longer changes.
  await openMenu(page);
  await page.getByRole("button", { name: "Stop automatic saving" }).click();
  const before = await readFile(page);
  await card.getByRole("button", { name: "Add note" }).click();
  await page.getByRole("dialog").getByLabel("Note").fill("Not saved to the file");
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await page.waitForTimeout(1500);
  expect(await readFile(page)).toBe(before);
});

test("choosing a file that already holds a backup merges it first", async ({ page }) => {
  await fakePicker(page);
  await start(page);
  await writeFile(page, JSON.stringify({ version: 3, claims: [{ id: "from-file", label: "From the file", category: "pharmacy", amount: 1000, date: "2026-01-05", items: [], log: [], mod: 1 }], deleted: {} }));
  await openMenu(page);
  await page.getByRole("button", { name: "Save automatically to a file…" }).click();
  await page.locator("button.chip", { hasText: "All" }).click();
  await expect(page.locator(".card .title")).toHaveText(["From the file"]);
  await expect.poll(() => readFile(page)).toContain("From the file");
});

test("browsers without file access show the manual backup instead", async ({ page }) => {
  await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
  await start(page);
  await openMenu(page);
  await expect(page.getByText("needs Chrome or Edge on a computer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save automatically to a file…" })).toHaveCount(0);
});
