import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorLogSource } from "./error.types";

const dbState = vi.hoisted(() => ({
  selects: [] as unknown[][],
  inserted: [] as Record<string, unknown>[],
  updated: [] as Record<string, unknown>[],
}));

vi.mock("../../../common/db", () => {
  const chain = (rows: () => unknown[]) => {
    const node: Record<string, unknown> = {};
    for (const name of ["from", "where"]) node[name] = () => node;
    node.limit = () => Promise.resolve(rows());
    return node;
  };
  return {
    db: {
      select: () => chain(() => dbState.selects.shift() ?? []),
      insert: () => ({
        values: (value: Record<string, unknown>) => {
          dbState.inserted.push(value);
          return { returning: () => Promise.resolve([{ id: "new-finding", ...value }]) };
        },
      }),
      update: () => ({
        set: (value: Record<string, unknown>) => {
          dbState.updated.push(value);
          return {
            where: () => ({ returning: () => Promise.resolve([{ id: "old-finding", ...value }]) }),
          };
        },
      }),
    },
  };
});

import { errorFingerprint } from "./error-fingerprint";
import { ErrorsService } from "./errors.service";

const sources: ErrorLogSource[] = [
  {
    id: "log-2",
    timestamp: "2026-11-14T10:05:00.000Z",
    service: "api",
    level: "error",
    message: "GET /requests?categoryId=b 500",
    traceId: "trace-2",
    spanId: "span-2",
    attributes: { "http.status_code": 500 },
  },
  {
    id: "log-1",
    timestamp: "2026-11-14T10:00:00.000Z",
    service: "api",
    level: "error",
    message: "GET /requests?categoryId=a 500",
    traceId: "trace-1",
    spanId: "span-1",
    attributes: { "http.status_code": 500 },
  },
];
const fingerprint = errorFingerprint(sources[0]!);

function build() {
  const search = vi.fn().mockResolvedValue({ hits: sources.map((source) => ({ _source: source })) });
  const cache = { getOrSet: (_key: string, _ttl: number, load: () => Promise<unknown>) => load() };
  const service = new ErrorsService({ search } as never, cache as never);
  return { service, search };
}

beforeEach(() => {
  dbState.selects = [];
  dbState.inserted = [];
  dbState.updated = [];
});

describe("ErrorsService", () => {
  it("lists groups with a fingerprint, trace and span", async () => {
    const { service, search } = build();
    const groups = await service.listGroups("org", "project", { from: "2026-11-14T00:00:00Z", to: "2026-11-15T00:00:00Z" });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ fingerprint, count: 2, traceCount: 2, traceId: "trace-2", spanId: "span-2" });
    expect(search.mock.calls[0]![1].query).toContain('level:"error" OR level:"fatal"');
  });

  it("returns occurrences and a timeline for one group", async () => {
    const { service } = build();
    const detail = await service.getGroup("org", "project", fingerprint, { from: "2026-11-14T00:00:00Z", to: "2026-11-15T00:00:00Z" });
    expect(detail.occurrences.map((item) => item.traceId)).toEqual(["trace-2", "trace-1"]);
    expect(detail.timeline.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(2);
  });

  it("rejects a fingerprint that is not in the range", async () => {
    const { service } = build();
    await expect(service.getGroup("org", "project", "0000000000000000")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("creates a critical finding with trace evidence", async () => {
    dbState.selects = [[], [{ id: "service-1" }]];
    const { service } = build();
    const result = await service.createFinding("org", "project", fingerprint, { from: "2026-11-14T00:00:00Z", to: "2026-11-15T00:00:00Z" });
    expect(result.status).toBe("created");
    expect(dbState.inserted).toHaveLength(1);
    expect(dbState.inserted[0]).toMatchObject({
      orgId: "org",
      projectId: "project",
      serviceId: "service-1",
      serviceName: "api",
      type: "error_group",
      severity: "critical",
      observedValue: 2,
      unit: "occurrences",
      title: "HTTP 500 in api: GET /requests 500",
    });
    const evidence = dbState.inserted[0]!.evidence as Array<{ kind: string; value: unknown }>;
    expect(evidence.some((item) => item.kind === "trace" && item.value === "trace-2")).toBe(true);
  });

  it("updates the existing finding instead of duplicating it", async () => {
    dbState.selects = [[{ id: "old-finding" }]];
    const { service } = build();
    const result = await service.createFinding("org", "project", fingerprint, { from: "2026-11-14T00:00:00Z", to: "2026-11-15T00:00:00Z" });
    expect(result.status).toBe("updated");
    expect(dbState.inserted).toHaveLength(0);
    expect(dbState.updated[0]).toMatchObject({ observedValue: 2 });
  });
});
