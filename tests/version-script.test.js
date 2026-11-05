import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL("../scripts/set-version.mjs", import.meta.url));

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), "lecture-notes-version-"));
  const files = {
    "manifest.json": `{
  "manifest_version": 3,
  "version": "2.1.2",
  "permissions": ["storage"]
}
`,
    "package.json": `${JSON.stringify({ name: "fixture", version: "2.1.2" }, null, 2)}\n`,
    "package-lock.json": `${JSON.stringify(
      {
        name: "fixture",
        version: "2.1.2",
        lockfileVersion: 3,
        packages: { "": { name: "fixture", version: "2.1.2" } },
      },
      null,
      2,
    )}\n`,
  };

  await Promise.all(
    Object.entries(files).map(([fileName, contents]) =>
      writeFile(join(directory, fileName), contents, "utf8"),
    ),
  );

  return { directory, files };
}

test("sets every project version without reformatting the manifest", async (context) => {
  const fixture = await createFixture();
  context.after(() => rm(fixture.directory, { recursive: true, force: true }));

  const result = await execFileAsync(process.execPath, [scriptPath, "2.2.0"], {
    cwd: fixture.directory,
  });

  assert.match(result.stdout, /Set project version to 2\.2\.0\./);
  const manifestSource = await readFile(join(fixture.directory, "manifest.json"), "utf8");
  assert.match(manifestSource, /"version": "2\.2\.0"/);
  assert.match(manifestSource, /"permissions": \["storage"\]/);

  for (const fileName of ["package.json", "package-lock.json"]) {
    const document = JSON.parse(await readFile(join(fixture.directory, fileName), "utf8"));
    assert.equal(document.version, "2.2.0");
  }

  const packageLock = JSON.parse(
    await readFile(join(fixture.directory, "package-lock.json"), "utf8"),
  );
  assert.equal(packageLock.packages[""].version, "2.2.0");
});

test("rejects an invalid version without changing project files", async (context) => {
  const fixture = await createFixture();
  context.after(() => rm(fixture.directory, { recursive: true, force: true }));

  await assert.rejects(
    execFileAsync(process.execPath, [scriptPath, "2.2"], { cwd: fixture.directory }),
  );

  for (const [fileName, contents] of Object.entries(fixture.files)) {
    assert.equal(await readFile(join(fixture.directory, fileName), "utf8"), contents);
  }
});
