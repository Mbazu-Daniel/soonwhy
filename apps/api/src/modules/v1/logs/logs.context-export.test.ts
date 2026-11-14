import { describe, expect, it, vi } from "vitest";
import { splitContext } from "./log-context";
import { csvCell, toCsv, toNdjson } from "./log-export";
import { LogsService } from "./logs.service";

const row = (id: string, timestamp: string, extra: Record<string, unknown> = {}) => ({ id, timestamp, level: "info", service: "api", message: `m-${id}`, attributes: {}, ...extra });
const anchor = { id: "b", timestamp: "2026-11-14T10:00:05.000Z" };

describe("splitContext", () => {
  it("returns lines around the anchor in time order and leaves the anchor out", () => {
    const result = splitContext(
      anchor,
      [row("a2", "2026-11-14T10:00:04.000Z"), row("b", anchor.timestamp), row("a1", "2026-11-14T10:00:03.000Z"), row("late", "2026-11-14T10:00:05.500Z")],
      [row("b", anchor.timestamp), row("c2", "2026-11-14T10:00:07.000Z"), row("c1", "2026-11-14T10:00:06.000Z")],
      5,
    );
    expect(result.before.map((item) => item.id)).toEqual(["a1", "a2"]);
    expect(result.after.map((item) => item.id)).toEqual(["c1", "c2"]);
  });

  it("limits each side and keeps the nearest lines", () => {
    const result = splitContext(
      anchor,
      [row("x1", "2026-11-14T10:00:01.000Z"), row("x2", "2026-11-14T10:00:02.000Z"), row("x3", "2026-11-14T10:00:03.000Z")],
      [],
      2,
    );
    expect(result.before.map((item) => item.id)).toEqual(["x2", "x3"]);
  });

  it("puts lines with the same timestamp after the anchor", () => {
    const result = splitContext(anchor, [], [row("tie", anchor.timestamp)], 5);
    expect(result.after.map((item) => item.id)).toEqual(["tie"]);
  });
});

describe("export formats", () => {
  it("quotes cells and neutralises spreadsheet formulas", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    for (const risky of ["+1", "-1", "@SUM(A1)", "\tcmd"]) expect(csvCell(risky).replace(/^"/, "")).toMatch(/^'/);
    expect(csvCell(undefined)).toBe("");
    expect(csvCell("plain")).toBe("plain");
  });

  it("writes a header, one line per row and attributes as JSON", () => {
    const csv = toCsv([row("1", "2026-11-14T10:00:00.000Z", { message: "line one\nline two", attributes: '{"a":"b"}' })]);
    const [header, ...rest] = csv.split("\r\n");
    expect(header).toBe("timestamp,level,service,message,traceId,spanId,attributes");
    expect(csv).toContain('"line one\nline two"');
    expect(csv).toContain('"{""a"":""b""}"');
    expect(rest.filter(Boolean)).toHaveLength(1);
  });

  it("writes one JSON object per line", () => {
    const lines = toNdjson([row("1", "2026-11-14T10:00:00.000Z"), row("2", "2026-11-14T10:00:01.000Z")]).trim().split("\n");
    expect(lines.map((line) => JSON.parse(line).message)).toEqual(["m-1", "m-2"]);
    expect(toNdjson([])).toBe("");
  });
});

describe("LogsService export and context", () => {
  const base = { projectId: "p", level: "all" as const, from: "2026-11-14T00:00:00.000Z", to: "2026-11-15T00:00:00.000Z" };

  it("pages through results until the limit and names the file", async () => {
    const queryLogs = vi.fn()
      .mockResolvedValueOnce({ rows: Array.from({ length: 1000 }, (_, i) => row(`r${i}`, "2026-11-14T10:00:00.000Z")), total: 1500 })
      .mockResolvedValueOnce({ rows: Array.from({ length: 300 }, (_, i) => row(`s${i}`, "2026-11-14T10:00:00.000Z")), total: 1500 });
    const service = new LogsService({ queryLogs } as never);
    const file = await service.exportLogs("org", { ...base, format: "csv", limit: 1300 });
    expect(queryLogs.mock.calls.map((call) => [call[0].limit, call[0].offset])).toEqual([[1000, 0], [300, 1000]]);
    expect(file.filename).toMatch(/^logs-.*\.csv$/);
    expect(file.contentType).toContain("text/csv");
  });

  it("rejects a hostile query on export before searching", async () => {
    const queryLogs = vi.fn();
    const service = new LogsService({ queryLogs } as never);
    await expect(service.exportLogs("org", { ...base, format: "ndjson", limit: 10, q: 'org_id:"x"' })).rejects.toThrow(/org_id/);
    expect(queryLogs).not.toHaveBeenCalled();
  });

  it("only allows context scopes on known fields", async () => {
    const queryContext = vi.fn().mockResolvedValue({ before: [], after: [] });
    const service = new LogsService({ queryContext } as never);
    await expect(service.getContext("org", { projectId: "p", id: "a", timestamp: anchor.timestamp, field: "org_id", value: "x", lines: 5 })).rejects.toThrow(/Unknown log field/);
    await service.getContext("org", { projectId: "p", id: "a", timestamp: anchor.timestamp, field: "attributes.host.name", value: "box-1", lines: 5 });
    expect(queryContext).toHaveBeenCalledWith(expect.objectContaining({ field: "attributes.host.name", value: "box-1", anchorMs: Date.parse(anchor.timestamp) }));
  });
});

describe("LogsRepository.queryContext", () => {
  it("searches the anchor's own second apart from the rest, so busy seconds cannot crowd out neighbours", async () => {
    const { LogsRepository } = await import("./logs.repository");
    const search = vi.fn().mockResolvedValue({ hits: [] });
    const repository = new LogsRepository({ search } as never);
    await repository.queryContext({ orgId: "o", projectId: "p", field: "service", value: "api", anchorMs: Date.parse("2026-11-14T10:00:05.300Z"), lines: 10 });
    const windows = search.mock.calls.map((call) => [call[1].from, call[1].to]);
    expect(windows).toEqual([
      ["2026-11-13T10:00:05.000Z", "2026-11-14T10:00:05.000Z"],
      ["2026-11-14T10:00:05.000Z", "2026-11-14T10:00:06.000Z"],
      ["2026-11-14T10:00:06.000Z", "2026-11-15T10:00:05.000Z"],
    ]);
  });
});
