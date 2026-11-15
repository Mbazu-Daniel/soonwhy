import { describe, expect, it } from "vitest";
import { dbPoolOptions } from "./pool-options";

describe("dbPoolOptions", () => {
  it("allows ten connections per service by default", () => {
    expect(dbPoolOptions({}).max).toBe(10);
  });

  it("reads the pool size from DB_POOL_MAX", () => {
    expect(dbPoolOptions({ DB_POOL_MAX: "25" }).max).toBe(25);
  });

  it("ignores a value that is not a positive whole number", () => {
    for (const bad of ["0", "-3", "2.5", "many", ""]) {
      expect(dbPoolOptions({ DB_POOL_MAX: bad }).max).toBe(10);
    }
  });

  it("keeps the fixed timeouts the services already used", () => {
    expect(dbPoolOptions({})).toMatchObject({
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 1800,
    });
  });
});
