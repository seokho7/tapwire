import assert from "node:assert/strict";
import { test } from "node:test";
import { pickSessionFile } from "../core/storage/file-picker.js";

test("native picker preserves Unicode and shell metacharacters in selected paths", async () => {
  const file = '/Users/test/한글 folder/$(literal) "capture".tpw';
  for (const platform of ["darwin", "win32", "linux"] as const) {
    assert.equal(await pickSessionFile(platform, async () => ({ stdout: file + "\n" })), file);
  }
  assert.equal(await pickSessionFile("win32", async () => ({ stdout: "C:\\한글\\capture.tpw\r\n" })), "C:\\한글\\capture.tpw");
});

test("cancellation stays distinct from native picker failures", async () => {
  for (const platform of ["darwin", "win32"] as const) {
    assert.equal(await pickSessionFile(platform, async () => ({ stdout: "\n" })), null);
    await assert.rejects(pickSessionFile(platform, async () => { throw new Error("permission denied"); }), /permission denied/);
  }
  assert.equal(await pickSessionFile("linux", async () => { throw Object.assign(new Error("cancelled"), { code: 1 }); }), null);
  let calls = 0;
  assert.equal(await pickSessionFile("linux", async () => {
    if (++calls === 1) throw Object.assign(new Error("missing"), { code: "ENOENT" });
    return { stdout: "/tmp/capture.tpw\n" };
  }), "/tmp/capture.tpw");
  await assert.rejects(pickSessionFile("linux", async () => {
    throw Object.assign(new Error("missing"), { code: "ENOENT" });
  }), /requires zenity or kdialog/);
});
