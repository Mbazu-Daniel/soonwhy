import { describe, expect, it, vi } from "vitest";
import { HostRegistry, normalizeHostName } from "./host-registry";

const targetOf = (projectId: string, organizationId = "o1") => ({ projectId, organizationId, scopes: ["ingest"] }) as never;


function build(rows: Array<{ projectId: string } | undefined>, defaultProject = "p-default") {
  const written: unknown[] = [];
  const updates: unknown[] = [];
  const queue = [...rows];
  const db = {
    select: vi.fn(() => ({ from: () => ({ where: () => Promise.resolve(queue.length ? [queue.shift()].filter(Boolean) : []) }) })),
    insert: vi.fn(() => ({ values: (value: unknown) => { written.push(value); return { onConflictDoNothing: () => Promise.resolve() }; } })),
    update: vi.fn(() => ({ set: (value: unknown) => { updates.push(value); return { where: () => Promise.resolve() }; } })),
  };
  const fallback = {
    resolve: vi.fn().mockResolvedValue(targetOf(defaultProject)),
    projectTarget: vi.fn(async (id: string) => targetOf(id)),
  };
  return { registry: new HostRegistry(db as never, fallback as never), db, fallback, written, updates };
}

describe("normalizeHostName", () => {
  it("trims and limits the name", () => {
    expect(normalizeHostName("  web-1 ")).toBe("web-1");
    expect(normalizeHostName(undefined)).toBe("");
    expect(normalizeHostName("x".repeat(400))).toHaveLength(255);
  });
});

describe("HostRegistry", () => {
  it("uses the default project when the collector sends no host name", async () => {
    const { registry, db } = build([]);
    expect((await registry.resolve(undefined))?.projectId).toBe("p-default");
    expect(db.select).not.toHaveBeenCalled();
  });

  it("files a known host under the project it is linked to", async () => {
    const { registry, fallback, db } = build([{ projectId: "p-web" }]);
    expect((await registry.resolve("web-1", 1_000))?.projectId).toBe("p-web");
    expect(fallback.projectTarget).toHaveBeenCalledWith("p-web");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("registers a new host under the default project", async () => {
    const { registry, written } = build([undefined, { projectId: "p-default" }]);
    expect((await registry.resolve("db-1", 1_000))?.projectId).toBe("p-default");
    expect(written).toEqual([expect.objectContaining({ hostName: "db-1", projectId: "p-default", organizationId: "o1" })]);
  });

  it("follows the winner when two collectors register the same host at once", async () => {
    const { registry } = build([undefined, { projectId: "p-other" }]);
    expect((await registry.resolve("db-1", 1_000))?.projectId).toBe("p-other");
  });

  it("stays unconfigured when no project exists to file a new host under", async () => {
    const { registry, fallback } = build([undefined]);
    fallback.resolve.mockResolvedValue(undefined);
    expect(await registry.resolve("db-1")).toBeUndefined();
  });

  it("caches a host so each batch does not hit the database", async () => {
    const { registry, db } = build([{ projectId: "p-web" }, { projectId: "p-web" }]);
    await registry.resolve("web-1", 1_000);
    await registry.resolve("web-1", 2_000);
    expect(db.select).toHaveBeenCalledTimes(1);
    await registry.resolve("web-1", 40_000);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it("records when a known host was last seen, at most once a minute", async () => {
    const { registry, updates } = build([{ projectId: "p-web" }, { projectId: "p-web" }, { projectId: "p-web" }]);
    await registry.resolve("web-1", 100_000);
    await registry.resolve("web-1", 140_000);
    await registry.resolve("web-1", 200_000);
    expect(updates).toHaveLength(2);
  });
});
