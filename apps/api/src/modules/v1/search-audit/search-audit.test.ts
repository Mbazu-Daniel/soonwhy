import { describe, expect, it, vi } from "vitest";
import { auditParams, MAX_PARAM_LENGTH } from "./search-audit.params";
import { SearchAuditService } from "./search-audit.service";

const request = (overrides: Record<string, unknown> = {}) =>
  ({
    orgId: "org1",
    params: { projectId: "p1" },
    query: { q: "level:error", limit: "50", cursor: "abc" },
    user: { id: "u1", name: "Ada", email: "ada@example.com" },
    ...overrides,
  }) as never;

describe("auditParams", () => {
  it("keeps the search filters and drops paging and unknown keys", () => {
    expect(auditParams({ q: "x", service: "api", limit: "50", cursor: "c", secret: "s" })).toEqual({ q: "x", service: "api" });
  });

  it("ignores empty and non-string values and clips long queries", () => {
    const result = auditParams({ q: "a".repeat(MAX_PARAM_LENGTH + 50), level: "", service: ["a", "b"] });
    expect(Object.keys(result)).toEqual(["q"]);
    expect(result.q).toHaveLength(MAX_PARAM_LENGTH);
  });
});

describe("SearchAuditService", () => {
  it("records who searched what, in which project", async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    new SearchAuditService({ insert } as never).record(request(), "logs.search");
    expect(insert).toHaveBeenCalledWith({
      orgId: "org1",
      projectId: "p1",
      userId: "u1",
      actor: "Ada",
      action: "logs.search",
      params: { q: "level:error" },
    });
  });

  it("records api key searches without a user", () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    new SearchAuditService({ insert } as never).record(request({ user: undefined }), "traces.search");
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ userId: null, actor: "api key" });
  });

  it("never throws when the write fails", async () => {
    const insert = vi.fn().mockRejectedValue(new Error("db down"));
    expect(() => new SearchAuditService({ insert } as never).record(request(), "logs.search")).not.toThrow();
    await Promise.resolve();
  });

  it("skips requests without an organization or project", () => {
    const insert = vi.fn();
    const service = new SearchAuditService({ insert } as never);
    service.record(request({ orgId: undefined }), "logs.search");
    service.record(request({ params: {} }), "logs.search");
    expect(insert).not.toHaveBeenCalled();
  });

  it("pages with a cursor and caps the page size", async () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ id: 10 - i }));
    const list = vi.fn().mockResolvedValue(rows);
    const result = await new SearchAuditService({ list } as never).list("org1", { limit: 3 });
    expect(list).toHaveBeenCalledWith("org1", { limit: 4 });
    expect(result.entries).toHaveLength(3);
    expect(result.nextBefore).toBe(8);
    await new SearchAuditService({ list } as never).list("org1", { limit: 5000 });
    expect(list).toHaveBeenLastCalledWith("org1", { limit: 101 });
  });
});
