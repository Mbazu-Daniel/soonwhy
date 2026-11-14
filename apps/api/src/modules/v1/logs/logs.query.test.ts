import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { clampHistogramStart, histogramInterval } from "./histogram-interval";
import { assertQueryableField, fieldNamesFromSample } from "./log-fields";
import { decodeOffset, nextOffsetCursor } from "./logs.cursor";
import { LogsService } from "./logs.service";

const range = { from: "2026-11-14T00:00:00.000Z", to: "2026-11-15T00:00:00.000Z" };

describe("histogramInterval", () => {
  it("scales the bucket size with the range", () => {
    expect(histogramInterval("2026-11-14T00:00:00Z", "2026-11-14T01:00:00Z")).toBe("60s");
    expect(histogramInterval("2026-11-14T00:00:00Z", "2026-11-15T00:00:00Z")).toBe("1800s");
    expect(histogramInterval("2026-11-01T00:00:00Z", "2026-11-15T00:00:00Z")).toBe("21600s");
  });

  it("limits the histogram start to 90 days before the end", () => {
    expect(clampHistogramStart("1970-01-01T00:00:00.000Z", "2026-11-14T00:00:00.000Z")).toBe("2026-08-16T00:00:00.000Z");
    expect(clampHistogramStart("2026-11-13T00:00:00.000Z", "2026-11-14T00:00:00.000Z")).toBe("2026-11-13T00:00:00.000Z");
  });

  it("never returns an interval above one day", () => {
    expect(histogramInterval("2020-01-01T00:00:00Z", "2026-01-01T00:00:00Z")).toBe("86400s");
  });
});

describe("log fields", () => {
  it("lists core fields then attributes by how often they appear", () => {
    const names = fieldNamesFromSample([
      { attributes: { "http.route": "/a", "http.status_code": "200" } },
      { attributes: JSON.stringify({ "http.status_code": "404" }) },
      { attributes: "not json" },
    ]);
    expect(names.map((field) => field.name)).toEqual([
      "level", "service", "traceId", "spanId", "attributes.http.status_code", "attributes.http.route",
    ]);
    expect(names.find((field) => field.name === "attributes.http.status_code")?.count).toBe(2);
  });

  it("only accepts core fields and attribute paths", () => {
    expect(assertQueryableField("level")).toBe("level");
    expect(assertQueryableField("attributes.http.route")).toBe("attributes.http.route");
    for (const bad of ["org_id", "project_id", "message", "attributes.", "attributes.a b", "attributes.x\"y"]) {
      expect(() => assertQueryableField(bad)).toThrow(BadRequestException);
    }
  });
});

describe("offset cursor", () => {
  it("round-trips and clamps garbage to the first page", () => {
    const cursor = nextOffsetCursor(0, 50, 50)!;
    expect(decodeOffset(cursor)).toBe(50);
    expect(decodeOffset("%%%")).toBe(0);
    expect(decodeOffset(undefined)).toBe(0);
  });

  it("stops after a short page and at Quickwit's result window", () => {
    expect(nextOffsetCursor(0, 20, 50)).toBeUndefined();
    expect(nextOffsetCursor(9_950, 50, 50)).toBeUndefined();
  });
});

describe("LogsService", () => {
  function build(overrides: Record<string, unknown> = {}) {
    const repository = {
      queryLogs: vi.fn().mockResolvedValue({
        rows: [{ id: "1", timestamp: "t", level: "info", service: "api", message: "m", attributes: '{"a":"b"}' }],
        total: 120,
      }),
      queryHistogram: vi.fn().mockResolvedValue({ aggregations: { timeline: {} }, total: 5 }),
      queryFieldSample: vi.fn().mockResolvedValue([]),
      queryFieldValues: vi.fn().mockResolvedValue([{ value: "200", count: 3 }]),
      ...overrides,
    };
    return { service: new LogsService(repository as never), repository };
  }
  const input = { projectId: "p", level: "all" as const, limit: 1, ...range };

  it("wraps the user query and applies the page offset", async () => {
    const { service, repository } = build();
    const cursor = Buffer.from(JSON.stringify({ offset: 30 })).toString("base64");
    const result = await service.getLogs("org", { ...input, q: "level:error AND timeout", cursor });
    expect(repository.queryLogs).toHaveBeenCalledWith(expect.objectContaining({ q: "level:error AND timeout", offset: 30, limit: 1 }));
    expect(result).toMatchObject({ total: 120, data: [{ attributes: { a: "b" } }] });
    expect(decodeOffset(result.nextCursor)).toBe(31);
  });

  it("rejects a query that tries to leave the tenant before touching Quickwit", async () => {
    const { service, repository } = build();
    await expect(service.getLogs("org", { ...input, q: '*) OR (service:"x"' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.queryLogs).not.toHaveBeenCalled();
  });

  it("turns a Quickwit parse failure into a readable 400", async () => {
    const { service } = build({
      queryLogs: vi.fn().mockRejectedValue(new Error('Quickwit request failed (400): {"message":"unexpected token"}')),
    });
    await expect(service.getLogs("org", { ...input, q: "level:" })).rejects.toThrow("Invalid search query: unexpected token");
  });

  it("does not hide other Quickwit failures", async () => {
    const { service } = build({ queryLogs: vi.fn().mockRejectedValue(new Error("Quickwit request failed (500): down")) });
    await expect(service.getLogs("org", input)).rejects.toThrow("down");
  });

  it("returns top values only for allowed fields", async () => {
    const { service, repository } = build();
    const result = await service.getFieldValues("org", { ...input, field: "attributes.http.status_code", size: 10 });
    expect(result).toEqual({ field: "attributes.http.status_code", data: [{ value: "200", count: 3 }] });
    await expect(service.getFieldValues("org", { ...input, field: "org_id", size: 10 })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.queryFieldValues).toHaveBeenCalledTimes(1);
  });

  it("includes the match count with the histogram", async () => {
    const { service } = build();
    expect(await service.getHistogram("org", input)).toMatchObject({ total: 5 });
  });
});
