import { assertSupportedEnvironment } from "./release-guards.mjs";

const versions = assertSupportedEnvironment();
console.log(`Environment check passed with Node ${versions.node} and npm ${versions.npm}.`);
