import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { DEPENDENCIES_PATH, MAX_REPORTED_PACKAGES, PNPM_STORE_DIRECTORY } from "./dependencies.constants.js";
import type { DependencyReportOptions } from "./dependencies.types.js";

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function subdirectories(directory: string): string[] {
  try {
    return readdirSync(directory).filter((name) => isDirectory(join(directory, name)));
  } catch {
    return [];
  }
}

function readPackage(directory: string): string | undefined {
  try {
    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as { name?: unknown; version?: unknown };
    return typeof manifest.name === "string" && typeof manifest.version === "string" ? `${manifest.name}@${manifest.version}` : undefined;
  } catch {
    return undefined;
  }
}

function packageDirectories(nodeModules: string): string[] {
  return subdirectories(nodeModules).flatMap((name) => {
    if (name === ".bin" || name === PNPM_STORE_DIRECTORY) return [];
    if (!name.startsWith("@")) return [join(nodeModules, name)];
    return subdirectories(join(nodeModules, name)).map((scoped) => join(nodeModules, name, scoped));
  });
}

function enclosingNodeModules(packageDirectory: string): string {
  const parent = dirname(packageDirectory);
  return parent.split(/[\\/]/).pop()?.startsWith("@") ? dirname(parent) : parent;
}

function collect(nodeModules: string, visited: Set<string>, found: Set<string>): void {
  let real: string;
  try {
    real = realpathSync(nodeModules);
  } catch {
    return;
  }
  if (visited.has(real)) return;
  visited.add(real);
  for (const directory of packageDirectories(nodeModules)) {
    const reference = readPackage(directory);
    if (reference) found.add(reference);
    collect(join(directory, "node_modules"), visited, found);
    try {
      collect(enclosingNodeModules(realpathSync(directory)), visited, found);
    } catch {
      continue;
    }
  }
  for (const stored of subdirectories(join(nodeModules, PNPM_STORE_DIRECTORY))) {
    collect(join(nodeModules, PNPM_STORE_DIRECTORY, stored, "node_modules"), visited, found);
  }
}

type Manifest = { name?: unknown; version?: unknown; dependencies?: Record<string, string>; optionalDependencies?: Record<string, string> };

function readManifest(directory: string): Manifest | undefined {
  try {
    return JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as Manifest;
  } catch {
    return undefined;
  }
}

function resolveDependency(name: string, from: string): string | undefined {
  let current = from;
  for (;;) {
    const candidate = join(current, "node_modules", name);
    if (readManifest(candidate)) return realpathSync(candidate);
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export function collectProductionPackages(root: string = process.cwd()): string[] {
  const manifest = readManifest(root);
  if (!manifest) return collectInstalledPackages(root);
  const found = new Set<string>();
  const visited = new Set<string>();
  const queue = [root];
  while (queue.length > 0 && found.size < MAX_REPORTED_PACKAGES) {
    const directory = queue.pop()!;
    const current = directory === root ? manifest : readManifest(directory);
    if (!current) continue;
    const names = Object.keys({ ...current.optionalDependencies, ...current.dependencies });
    for (const name of names) {
      const resolved = resolveDependency(name, directory);
      if (!resolved || visited.has(resolved)) continue;
      visited.add(resolved);
      const reference = readPackage(resolved);
      if (reference) found.add(reference);
      queue.push(resolved);
    }
  }
  return [...found].sort();
}

export function collectInstalledPackages(root: string = process.cwd()): string[] {
  const found = new Set<string>();
  collect(join(root, "node_modules"), new Set(), found);
  return [...found].sort().slice(0, MAX_REPORTED_PACKAGES);
}

export async function reportDependencies(options: DependencyReportOptions): Promise<boolean> {
  const packages = options.includeDev ? collectInstalledPackages(options.root) : collectProductionPackages(options.root);
  if (packages.length === 0) return false;
  const response = await options.fetch(`${options.apiEndpoint.replace(/\/+$/, "")}/${DEPENDENCIES_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${options.apiKey}` },
    body: JSON.stringify({ serviceName: options.serviceName, ecosystem: "npm", packages }),
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  return response.ok;
}
