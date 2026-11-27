// TEMPORARY: find which step makes the browser exit on GitHub's runners. Will be removed.
import { test } from "@playwright/test";

test("diagnostic: stored file handle after reload", async ({ page }) => {
  const log: string[] = [];
  page.on("console", (m) => { log.push(m.text()); console.log("PAGE:", m.text()); });
  page.on("close", () => console.log("PAGE CLOSED after:", log.at(-1)));
  // A page of the app's origin that does not run the app.
  await page.goto("/manifest.webmanifest");
  await page.evaluate(async () => {
    const h = await (await navigator.storage.getDirectory()).getFileHandle("diag.json", { create: true });
    const db = await new Promise<IDBDatabase>((r) => { const q = indexedDB.open("diag", 1); q.onupgradeneeded = () => q.result.createObjectStore("s"); q.onsuccess = () => r(q.result); });
    await new Promise((r) => { const tx = db.transaction("s", "readwrite"); tx.objectStore("s").put(h, "h"); tx.oncomplete = r; });
    console.log("1 stored handle in IndexedDB");
  });
  await page.reload();
  await page.evaluate(async () => {
    const step = (s: string) => console.log(s);
    step("2 after reload, opening IndexedDB");
    const db = await new Promise<IDBDatabase>((r) => { const q = indexedDB.open("diag", 1); q.onsuccess = () => r(q.result); });
    step("3 reading the handle");
    const h = await new Promise<FileSystemFileHandle>((r) => { const g = db.transaction("s").objectStore("s").get("h"); g.onsuccess = () => r(g.result); });
    step(`4 got handle: ${h?.name}`);
    const perm = await (h as unknown as { queryPermission(o: object): Promise<string> }).queryPermission({ mode: "readwrite" });
    step(`5 queryPermission: ${perm}`);
    const f = await h.getFile();
    step(`6 getFile size ${f.size}`);
    const w = await h.createWritable();
    step("7 createWritable ok");
    await w.write("x");
    await w.close();
    step("8 write ok");
  });
});
