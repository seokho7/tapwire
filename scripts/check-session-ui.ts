import { chromium } from "playwright";
import { packet } from "../tests/fixtures.js";
import { encodeArchive } from "../core/storage/archive.js";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

// Run against a disposable server on this PC: this check imports fixture packets.
// Native dialog selection is substituted with a path; the real server reads the file.
const base = process.argv[2];
if (!base) throw new Error("Usage: tsx scripts/check-session-ui.ts http://localhost:<test-port>");
const records = [packet({ id: "e2e-large", resBody: "한글\n".repeat(120000) }),
  packet({ id: "e2e-empty", reqBody: "", resBody: null })];
const chunks: Buffer[] = [];
for await (const chunk of encodeArchive(records)) chunks.push(chunk);
const directory = await fs.mkdtemp(path.join(tmpdir(), "tapwire-ui-"));
const file = path.join(directory, '한글 $(literal) "capture".tpw');
await fs.writeFile(file, Buffer.concat(chunks));
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  let cancel = false;
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/session/load-file", async route => {
    assert.equal(route.request().method(), "POST");
    assert.equal(route.request().postDataBuffer(), null, "Load must not upload a file or request body");
    if (cancel) {
      await route.fulfill({ json: { cancelled: true, imported: 0, skipped: 0 } });
    } else {
      const response = await route.fetch({ headers: { "Content-Type": "application/json" }, postData: JSON.stringify({ path: file }) });
      await route.fulfill({ response });
    }
  });
  await page.route("**/api/session", route => {
    assert.equal(route.request().method(), "GET", "Load must never use the upload endpoint");
    return route.continue();
  });
  await page.goto(base);
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "2 packets loaded" }).waitFor();
  assert.deepEqual(await (await fetch(base + "/api/packets/e2e-large")).json(), records[0]);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const download = await downloading;
  const saved = await fs.readFile((await download.path())!);
  assert.deepEqual([...saved.subarray(0, 3)], [84, 87, 3]);
  assert.equal(await download.failure(), null);
  await fs.writeFile(file, saved);
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "0 packets loaded · 2 duplicates skipped" }).waitFor();
  await fs.writeFile(file, saved.subarray(0, saved.length - 1));
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Load failed:" }).waitFor();
  cancel = true;
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Load cancelled." }).waitFor();
  assert.equal((await (await fetch(base + "/api/packets")).json()).total, 2);
  assert.equal((await fetch(base + "/api/session?limit=oops")).status, 400);
  assert.equal((await fetch(base + "/api/session/load-file", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/missing-tapwire-test-directory/missing.tpw" }),
  })).status, 400);
  assert.equal((await fetch(base + "/api/packets")).status, 200);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ localPathLoad: "passed (dialog selection simulated)", noFileUpload: true,
    downloadBytes: saved.length, largeBodyExact: true, cancellation: "passed",
    duplicateCount: "passed", corruptionRollback: "passed", pageErrors: errors }));
} finally { await browser.close(); await fs.rm(directory, { recursive: true, force: true }); }
