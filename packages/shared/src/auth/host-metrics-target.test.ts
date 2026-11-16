import { describe, expect, it, vi } from "vitest";
import { HostMetricsTarget } from "./host-metrics-target";

function fakeDb(selects: unknown[][]) {
  const queue = [...selects];
  const written: unknown[] = [];
  const select = vi.fn(() => {
    const result = queue.shift() ?? [];
    const node: any = {
      from: () => node,
      leftJoin: () => node,
      orderBy: () => node,
      limit: () => Promise.resolve(result),
      where: () => Object.assign(Promise.resolve(result), { orderBy: () => node, limit: () => Promise.resolve(result) }),
    };
    return node;
  });
  const insert = vi.fn(() => ({
    values: (value: unknown) => {
      written.push(value);
      return { onConflictDoUpdate: () => Promise.resolve() };
    },
  }));
  return { select, insert, written };
}

const project = { projectId: "p1", organizationId: "o1", maxAttributeCount: null, maxAttributeValueLength: null };

describe("HostMetricsTarget", () => {
  it("uses the saved project with default capture limits", async () => {
    const db = fakeDb([[{ value: " p1 " }], [project]]);
    const resolved = await new HostMetricsTarget(db as never).resolve();
    expect(resolved).toMatchObject({
      projectId: "p1",
      organizationId: "o1",
      scopes: ["ingest"],
      captureSettings: { maxAttributeCount: 100, maxAttributeValueLength: 4096 },
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("picks the oldest project and saves the choice when nothing is set", async () => {
    const db = fakeDb([[], [{ id: "p-old" }], [{ ...project, projectId: "p-old" }]]);
    const resolved = await new HostMetricsTarget(db as never).resolve();
    expect(resolved?.projectId).toBe("p-old");
    expect(db.written).toEqual([{ key: "host_metrics_project_id", value: "p-old" }]);
  });

  it("picks again when the saved project no longer exists", async () => {
    const db = fakeDb([[{ value: "gone" }], [], [{ id: "p2" }], [{ ...project, projectId: "p2" }]]);
    const resolved = await new HostMetricsTarget(db as never).resolve();
    expect(resolved?.projectId).toBe("p2");
    expect(db.written).toEqual([{ key: "host_metrics_project_id", value: "p2" }]);
  });

  it("stays unconfigured when there are no projects at all", async () => {
    const db = fakeDb([[], []]);
    expect(await new HostMetricsTarget(db as never).resolve()).toBeUndefined();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("caches the answer so each batch does not hit the database", async () => {
    const db = fakeDb([[{ value: "p1" }], [project], [{ value: "p1" }], [project]]);
    const target = new HostMetricsTarget(db as never);
    await target.resolve(1_000);
    await target.resolve(2_000);
    expect(db.select).toHaveBeenCalledTimes(2);
    await target.resolve(40_000);
    expect(db.select).toHaveBeenCalledTimes(4);
  });
});
