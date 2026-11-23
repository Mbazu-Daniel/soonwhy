import { afterEach, describe, expect, it } from "vitest";
import { assertTestDatabase, testDatabaseUrl } from "../src";

describe("assertTestDatabase", () => {
  it("accepts a database whose name marks it as a test database", () => {
    expect(assertTestDatabase("postgres://u:p@localhost:5433/soonwhy_test")).toBe("soonwhy_test");
  });

  it("refuses a database that does not look like a test database", () => {
    expect(() => assertTestDatabase("postgres://u:p@localhost:5433/soonwhy")).toThrow(/must contain "test"/);
  });

  it("refuses names with characters that are not safe in a statement", () => {
    expect(() => assertTestDatabase('postgres://u:p@localhost:5433/test"; drop')).toThrow(/Invalid test database name/);
  });
});

describe("testDatabaseUrl", () => {
  const saved = { test: process.env.TEST_DATABASE_URL, source: process.env.DATABASE_URL };

  afterEach(() => {
    if (saved.test === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = saved.test;
    if (saved.source === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved.source;
  });

  it("prefers TEST_DATABASE_URL", () => {
    process.env.TEST_DATABASE_URL = "postgres://a:b@host:1/custom_test";
    expect(testDatabaseUrl()).toBe("postgres://a:b@host:1/custom_test");
  });

  it("derives a test database from DATABASE_URL when nothing else is set", () => {
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL = "postgres://a:b@host:5/real";
    expect(testDatabaseUrl()).toBe("postgres://a:b@host:5/soonwhy_test");
  });
});
