import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const [version, ...extraArguments] = process.argv.slice(2);

assert.equal(extraArguments.length, 0, "Pass exactly one version");
assert.match(version || "", versionPattern, "Use a numeric X.Y.Z version");

const fileNames = ["manifest.json", "package.json", "package-lock.json"];
const sources = await Promise.all(fileNames.map((fileName) => readFile(fileName, "utf8")));
const documents = sources.map((source) => JSON.parse(source));

const [manifest, packageJson, packageLock] = documents;
assert.equal(typeof packageLock.packages?.[""], "object", "Package lock root is missing");
assert.equal(packageJson.version, manifest.version, "Package version does not match manifest");
assert.equal(packageLock.version, manifest.version, "Package lock version does not match manifest");
assert.equal(
  packageLock.packages[""].version,
  manifest.version,
  "Package lock root version does not match manifest",
);

const manifestVersionLine = /^ {2}"version": "[^"]+",$/gm;
assert.equal(
  [...sources[0].matchAll(manifestVersionLine)].length,
  1,
  "Manifest version line is missing",
);

const outputs = [
  sources[0].replace(manifestVersionLine, `  "version": "${version}",`),
  `${JSON.stringify({ ...packageJson, version }, null, 2)}\n`,
  `${JSON.stringify(
    {
      ...packageLock,
      version,
      packages: {
        ...packageLock.packages,
        "": { ...packageLock.packages[""], version },
      },
    },
    null,
    2,
  )}\n`,
];

await Promise.all(
  fileNames.map((fileName, index) =>
    outputs[index] === sources[index]
      ? Promise.resolve()
      : writeFile(fileName, outputs[index], "utf8"),
  ),
);

console.log(`Set project version to ${version}.`);
