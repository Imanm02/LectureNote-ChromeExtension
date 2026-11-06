import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  assertReleaseTagAvailable,
  assertSupportedEnvironment,
  parseVersion,
} from "../scripts/release-guards.mjs";

const execFileAsync = promisify(execFile);

test("accepts only the supported Node and npm lines", () => {
  assert.deepEqual(parseVersion("v24.15.0"), [24, 15, 0]);
  assert.deepEqual(
    assertSupportedEnvironment({
      nodeVersion: "v24.15.0",
      npmUserAgent: "npm/11.12.1 node/v24.15.0 win32 x64",
    }),
    { node: "24.15.0", npm: "11.12.1" },
  );
  assert.doesNotThrow(() => assertSupportedEnvironment({
    nodeVersion: "v26.0.0",
    npmUserAgent: "npm/11.99.0 node/v26.0.0 win32 x64",
  }));
  assert.throws(() => assertSupportedEnvironment({
    nodeVersion: "v25.9.0",
    npmUserAgent: "npm/11.12.1 node/v25.9.0 win32 x64",
  }), /Node 25\.9\.0 is unsupported/u);
  assert.throws(() => assertSupportedEnvironment({
    nodeVersion: "v24.22.1",
    npmUserAgent: "npm/12.0.0 node/v24.22.1 win32 x64",
  }), /npm 12\.0\.0 is unsupported/u);
});

test("rejects invalid version text", () => {
  assert.throws(() => parseVersion("24.15"), /numeric X\.Y\.Z/u);
  assert.throws(() => assertSupportedEnvironment({
    nodeVersion: "v24.22.1",
    npmUserAgent: "node/v24.22.1 win32 x64",
  }), /could not be read/u);
});

test("rejects a release version tagged on another commit", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "lecture-notes-release-guard-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const git = (argumentsValue) => execFileAsync("git", argumentsValue, { cwd: root });

  await git(["init"]);
  await git(["config", "user.name", "Test User"]);
  await git(["config", "user.email", "test@example.com"]);
  await writeFile(join(root, "package.json"), '{"version":"1.2.3"}\n', "utf8");
  await git(["add", "package.json"]);
  await git(["commit", "-m", "Initial"]);

  assert.equal((await assertReleaseTagAvailable(root)).status, "unused");
  await git(["tag", "-a", "v1.2.3", "-m", "Version 1.2.3"]);
  assert.equal((await assertReleaseTagAvailable(root)).status, "current");

  await writeFile(join(root, "sample.txt"), "changed\n", "utf8");
  await git(["add", "sample.txt"]);
  await git(["commit", "-m", "Change"]);
  await assert.rejects(
    assertReleaseTagAvailable(root),
    /v1\.2\.3 already points to another commit/u,
  );
});
