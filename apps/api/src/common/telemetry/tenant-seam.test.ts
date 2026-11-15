import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");

const PLATFORM_LEVEL = [
  "modules/v1/pipeline-lag/pipeline-lag.service.ts",
  "modules/v1/self-monitoring/pipeline-health.cron.ts",
  "modules/v1/retention/retention-policies.service.ts",
  "modules/v1/index-health/index-health.service.ts",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}

describe("telemetry search seam", () => {
  const files = sourceFiles(SRC).map((path) => ({ path: relative(SRC, path), text: readFileSync(path, "utf8") }));

  it("keeps tenant scoping inside common/telemetry and common/quickwit", () => {
    const offenders = files
      .filter((file) => !file.path.startsWith("common/") && !PLATFORM_LEVEL.includes(file.path))
      .filter((file) => /quickwitTenantQuery\(|quickwit\.search[<(]/.test(file.text))
      .map((file) => file.path);
    expect(offenders, "search through searchTenant or TelemetryQueryService instead").toEqual([]);
  });

  it("lists only platform level files that really exist", () => {
    const known = new Set(files.map((file) => file.path));
    for (const path of PLATFORM_LEVEL) expect(known.has(path), path).toBe(true);
  });
});
