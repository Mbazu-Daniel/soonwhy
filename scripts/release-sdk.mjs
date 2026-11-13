import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PACKAGE_DIRS = ["node", "nest", "next", "vite"].map((d) => `sdk/${d}`);
const bumpArgIndex = process.argv.indexOf("--bump");
const bumpKind = bumpArgIndex === -1 ? "patch" : process.argv[bumpArgIndex + 1];
const dryRun = !process.argv.includes("--yes");

if (!["major", "minor", "patch", "none"].includes(bumpKind)) {
  console.error(`unknown --bump=${bumpKind} (expected major|minor|patch|none)`);
  process.exit(2);
}

const versions = new Map(
  PACKAGE_DIRS.map((dir) => {
    const pkg = JSON.parse(readFileSync(`${dir}/package.json`, "utf8"));
    return [dir, pkg.version];
  }),
);
const unique = [...new Set(versions.values())];
if (unique.length !== 1) {
  console.error("SDK packages are not aligned on one version:");
  for (const [dir, v] of versions) console.error(`  ${dir}: ${v}`);
  process.exit(1);
}
const current = unique[0];
const parts = current.split(".").map(Number);
if (parts.length !== 3 || parts.some(Number.isNaN)) {
  console.error(`unparseable version: ${current}`);
  process.exit(1);
}
const next = bumpKind === "none" ? current : bump(parts, bumpKind);
const bumping = next !== current;

const tag = `sdk-v${next}`;
const localTags = execSync("git tag --list", { encoding: "utf8" }).trim();
if (localTags.split("\n").includes(tag)) {
  console.error(`tag ${tag} already exists locally`);
  process.exit(1);
}
const remoteTags = execSync("git ls-remote --tags origin", { encoding: "utf8" });
if (remoteTags.includes(`refs/tags/${tag}`)) {
  console.error(`tag ${tag} already exists on origin`);
  process.exit(1);
}

if (dryRun) {
  const action = bumping
    ? `would bump ${current} -> ${next} (--${bumpKind}), commit, tag ${tag}, push`
    : `SDK aligned at ${current}; --bump none: would build, test, tag ${tag} at current HEAD, push`;
  console.log(action);
  process.exit(0);
}

if (bumping) {
  for (const dir of PACKAGE_DIRS) {
    const path = `${dir}/package.json`;
    const pkg = JSON.parse(readFileSync(path, "utf8"));
    pkg.version = next;
    writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
  }
  console.log(`wrote ${next} to ${PACKAGE_DIRS.length} SDK packages`);
  run("git add " + PACKAGE_DIRS.map((d) => `${d}/package.json`).join(" "));
  run(`git commit -m "chore(sdk): release v${next}"`);
} else {
  console.log(`release ${current} as-is (--bump none)`);
}

const pnpm = "pnpm";
run(`${pnpm} --filter @soonwhy/node --filter @soonwhy/nest --filter @soonwhy/next --filter @soonwhy/vite build`);
run(`${pnpm} --filter @soonwhy/node --filter @soonwhy/nest --filter @soonwhy/next --filter @soonwhy/vite test -- --run`);

run(`git tag ${tag}`);
if (bumping) run("git push");
run(`git push origin ${tag}`);
console.log(`released ${tag}`);
console.log(`watch the Release SDK workflow: gh run list --workflow release-sdk.yml`);

function bump([major, minor, patch], kind) {
  if (kind === "major") return [major + 1, 0, 0].join(".");
  if (kind === "minor") return [major, minor + 1, 0].join(".");
  return [major, minor, patch + 1].join(".");
}

function run(cmd) {
  console.log("+", cmd);
  execSync(cmd, { stdio: "inherit" });
}
