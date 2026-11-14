import { describe, expect, it } from "vitest";
import { summarizeStack } from "./stack-summary";

const STACK = [
  "Error: query failed",
  "    at UsersService.find (/app/src/users/users.service.ts:42:11)",
  "    at /app/node_modules/express/lib/router/layer.js:95:5",
  "    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)",
  "Caused by: Error: connection refused",
  "    at connect (/app/node_modules/pg/lib/client.js:10:3)",
  "    at Pool.acquire (/app/src/db/pool.ts:8:2)",
].join("\n");

describe("summarizeStack", () => {
  it("keeps only application frames for the top error", () => {
    expect(summarizeStack(STACK)?.applicationFrames).toEqual([
      "at UsersService.find (/app/src/users/users.service.ts:42:11)",
    ]);
  });

  it("lists causes with their first application frame", () => {
    expect(summarizeStack(STACK)?.causes).toEqual([
      { header: "Error: connection refused", topFrame: "at Pool.acquire (/app/src/db/pool.ts:8:2)" },
    ]);
  });

  it("returns null for empty input", () => {
    expect(summarizeStack("  ")).toBeNull();
    expect(summarizeStack(undefined)).toBeNull();
  });
});
