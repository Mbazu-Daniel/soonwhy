import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectInstalledPackages, collectProductionPackages, reportDependencies } from "./dependencies.js";

const roots: string[] = [];

function project(layout: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "soonwhy-deps-"));
  roots.push(root);
  for (const [directory, version] of Object.entries(layout)) {
    const path = join(root, directory);
    mkdirSync(path, { recursive: true });
    const name = directory.split("node_modules/").pop()!;
    writeFileSync(join(path, "package.json"), JSON.stringify({ name, version }));
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("collectInstalledPackages", () => {
  it("finds flat, scoped and nested npm packages", () => {
    const root = project({
      "node_modules/lodash": "4.17.20",
      "node_modules/@nestjs/core": "11.0.0",
      "node_modules/express/node_modules/qs": "6.5.0",
      "node_modules/express": "4.17.1",
    });
    expect(collectInstalledPackages(root)).toEqual(["@nestjs/core@11.0.0", "express@4.17.1", "lodash@4.17.20", "qs@6.5.0"]);
  });

  it("finds pnpm store packages without double counting", () => {
    const root = project({
      "node_modules/.pnpm/minimist@1.2.0/node_modules/minimist": "1.2.0",
      "node_modules/.pnpm/@scope+pkg@2.0.0/node_modules/@scope/pkg": "2.0.0",
    });
    expect(collectInstalledPackages(root)).toEqual(["@scope/pkg@2.0.0", "minimist@1.2.0"]);
  });

  it("returns nothing when node_modules is missing", () => {
    expect(collectInstalledPackages(project({}))).toEqual([]);
  });
});

describe("collectProductionPackages", () => {
  const withManifest = (root: string, manifest: object) => writeFileSync(join(root, "package.json"), JSON.stringify(manifest));

  it("follows production dependencies and leaves out dev tools", () => {
    const root = project({
      "node_modules/express": "4.17.1",
      "node_modules/qs": "6.5.0",
      "node_modules/vitest": "3.0.0",
      "node_modules/unrelated": "1.0.0",
    });
    writeFileSync(join(root, "node_modules/express/package.json"), JSON.stringify({ name: "express", version: "4.17.1", dependencies: { qs: "^6" } }));
    withManifest(root, { name: "app", dependencies: { express: "^4" }, devDependencies: { vitest: "^3" } });
    expect(collectProductionPackages(root)).toEqual(["express@4.17.1", "qs@6.5.0"]);
  });

  it("falls back to everything installed when the app has no package.json", () => {
    const root = project({ "node_modules/lodash": "4.17.20" });
    expect(collectProductionPackages(root)).toEqual(["lodash@4.17.20"]);
  });
});

describe("reportDependencies", () => {
  it("posts the package list with the api key and service name", async () => {
    const root = project({ "node_modules/lodash": "4.17.20" });
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    const sent = await reportDependencies({ apiEndpoint: "https://api.test/api/v1/", apiKey: "sk_1", serviceName: "web", fetch, timeoutMs: 1000, root });
    expect(sent).toBe(true);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.test/api/v1/sdk/dependencies");
    expect(init.headers.authorization).toBe("Bearer sk_1");
    expect(JSON.parse(init.body)).toEqual({ serviceName: "web", ecosystem: "npm", packages: ["lodash@4.17.20"] });
  });

  it("sends nothing when no packages are installed", async () => {
    const fetch = vi.fn();
    expect(await reportDependencies({ apiEndpoint: "https://api.test", apiKey: "k", serviceName: "web", fetch, timeoutMs: 1000, root: project({}) })).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
