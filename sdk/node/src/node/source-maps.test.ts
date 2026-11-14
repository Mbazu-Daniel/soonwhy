import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enableSourceMaps } from "./source-maps.js";

const nativeRequire = createRequire(import.meta.url);

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "soonwhy-sourcemap-"));
  const map = { version: 3, file: "bundle.js", sources: ["original-orders.ts"], names: [], mappings: "AAAA" };
  const encoded = Buffer.from(JSON.stringify(map)).toString("base64");
  const file = join(dir, "bundle.js");
  writeFileSync(
    file,
    `module.exports = () => new Error("mapped");\n//# sourceMappingURL=data:application/json;base64,${encoded}\n`,
  );
  return file;
}

describe("enableSourceMaps", () => {
  it("rewrites stacks to the original source file", () => {
    expect(enableSourceMaps()).toBe(true);
    const make = nativeRequire(fixture()) as () => Error;
    expect(make().stack).toContain("original-orders.ts");
    expect(make().stack).not.toMatch(/bundle\.js:\d+/);
    process.setSourceMapsEnabled(false);
  });
});
