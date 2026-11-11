import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const add = vi.fn();
const record = vi.fn();

vi.mock("./client", () => ({
  rawDb: {
    select: () => ({
      then: (onFulfilled: (value: string) => unknown, onRejected: unknown) =>
        Promise.resolve("rows").then(onFulfilled, onRejected as never),
    }),
    insert: () => ({
      then: (onFulfilled: unknown, onRejected: unknown) =>
        Promise.reject(new Error("boom")).then(
          onFulfilled as never,
          onRejected as never,
        ),
    }),
    transaction: "not-a-function",
  },
}));

vi.mock("../telemetry/otel-metrics", () => ({
  getDbQueryCount: () => ({ add }),
  getDbQueryDuration: () => ({ record }),
}));

let instrumentedDb: any;

beforeAll(async () => {
  const module = await import("./instrumented");
  instrumentedDb = module.instrumentedDb;
});

beforeEach(() => {
  add.mockClear();
  record.mockClear();
});

describe("instrumentedDb", () => {
  it("passes resolved values to the caller and records the query", async () => {
    const value = await instrumentedDb.select();

    expect(value).toBe("rows");
    expect(add).toHaveBeenCalledWith(1, {
      service: "soonwhy-api",
      query: "select:unknown",
    });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("forwards caller handlers on then", async () => {
    const seen: string[] = [];
    const value = await instrumentedDb
      .select()
      .then((rows: string) => {
        seen.push(rows);
        return `${rows}!`;
      });

    expect(seen).toEqual(["rows"]);
    expect(value).toBe("rows!");
    expect(add).toHaveBeenCalledTimes(1);
  });

  it("records failures and preserves the rejection", async () => {
    await expect(instrumentedDb.insert()).rejects.toThrow("boom");

    expect(add).toHaveBeenCalledWith(1, {
      service: "soonwhy-api",
      query: "insert:unknown",
      error: "true",
    });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("returns non-function properties untouched", () => {
    expect(instrumentedDb.transaction).toBe("not-a-function");
  });
});
