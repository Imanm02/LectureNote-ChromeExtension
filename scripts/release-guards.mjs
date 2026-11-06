import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const VERSION_PATTERN = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

export function parseVersion(value, label = "Version") {
  const match = VERSION_PATTERN.exec(value || "");
  if (!match) {
    throw new Error(`${label} must use numeric X.Y.Z form.`);
  }
  return match.slice(1).map(Number);
}

function versionAtLeast(actual, minimum) {
  return actual.some((part, index) =>
    part > minimum[index] && actual.slice(0, index).every((value, prior) =>
      value === minimum[prior]
    )
  ) || actual.every((part, index) => part === minimum[index]);
}

export function assertSupportedEnvironment({
  nodeVersion = process.version,
  npmUserAgent = process.env.npm_config_user_agent,
} = {}) {
  const node = parseVersion(nodeVersion, "Node version");
  const nodeSupported = (node[0] === 24 && versionAtLeast(node, [24, 15, 0])) || node[0] >= 26;
  if (!nodeSupported) {
    throw new Error(
      `Node ${nodeVersion.replace(/^v/u, "")} is unsupported. Use Node 24.15 or newer in the Node 24 line, or Node 26 or newer.`,
    );
  }

  const npmMatch = /(?:^|\s)npm\/([^\s]+)/u.exec(npmUserAgent || "");
  if (!npmMatch) {
    throw new Error("The npm version could not be read. Run this check through npm.");
  }
  const npm = parseVersion(npmMatch[1], "npm version");
  const npmSupported = npm[0] === 11 && versionAtLeast(npm, [11, 12, 1]);
  if (!npmSupported) {
    throw new Error(`npm ${npmMatch[1]} is unsupported. Use npm 11.12.1 or newer in the npm 11 line.`);
  }

  return { node: nodeVersion.replace(/^v/u, ""), npm: npmMatch[1] };
}

async function gitOutput(root, argumentsValue) {
  const result = await execFileAsync("git", argumentsValue, { cwd: root });
  return result.stdout.trim();
}

export async function assertReleaseTagAvailable(root = process.cwd()) {
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  parseVersion(packageJson.version, "Package version");
  const tagName = `v${packageJson.version}`;
  const head = await gitOutput(root, ["rev-parse", "HEAD"]);
  let tagCommit = null;

  try {
    tagCommit = await gitOutput(root, [
      "rev-parse",
      "--verify",
      "--quiet",
      `refs/tags/${tagName}^{commit}`,
    ]);
  } catch (error) {
    if (error?.code !== 1) {
      throw error;
    }
  }

  if (tagCommit && tagCommit !== head) {
    throw new Error(
      `${tagName} already points to another commit. Set a new project version before packaging.`,
    );
  }

  return { version: packageJson.version, tagName, head, status: tagCommit ? "current" : "unused" };
}
