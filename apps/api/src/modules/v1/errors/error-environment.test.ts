import { describe, expect, it } from "vitest";
import { inEnvironment } from "./error-environment";
import { groupErrorLogs } from "./error-groups";
import type { ErrorLogSource } from "./error.types";

const source = (environment: string | undefined, timestamp: string): ErrorLogSource => ({
  id: timestamp,
  timestamp,
  service: "api",
  environment,
  level: "warn",
  message: "POST /sign-in 401",
  attributes: { "http.status_code": "401" },
});

const SOURCES = [
  source("development", "2026-11-14T15:08:15Z"),
  source("production", "2026-11-16T00:15:13Z"),
  source(undefined, "2026-11-16T00:20:00Z"),
];

describe("inEnvironment", () => {
  it("keeps everything when no environment is chosen", () => {
    expect(inEnvironment(SOURCES)).toHaveLength(3);
  });

  it("keeps only the chosen environment", () => {
    expect(inEnvironment(SOURCES, "production").map((item) => item.environment)).toEqual(["production"]);
  });
});

describe("environments on a group", () => {
  it("lists every environment seen, sorted, ignoring blanks", () => {
    const [group] = groupErrorLogs(SOURCES);
    expect(group?.environments).toEqual(["development", "production"]);
  });

  it("counts only the chosen environment", () => {
    const [group] = groupErrorLogs(inEnvironment(SOURCES, "production"));
    expect(group?.count).toBe(1);
    expect(group?.environments).toEqual(["production"]);
  });
});
