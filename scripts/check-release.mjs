import { assertReleaseTagAvailable } from "./release-guards.mjs";

const release = await assertReleaseTagAvailable();
const detail = release.status === "current"
  ? `${release.tagName} matches the current commit`
  : `${release.tagName} is available`;
console.log(`Release version check passed: ${detail}.`);
