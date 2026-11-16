import { describe, expect, it, vi } from "vitest";
import { searchOrg, searchTenant } from "./tenant-search";

const fake = () => ({ search: vi.fn().mockResolvedValue({ hits: [], num_hits: 0, elapsed_time_micros: 0 }) });
const scope = { orgId: "orgone", projectId: "projone" };

describe("searchTenant", () => {
  it("always scopes the query to the organization and project and picks the index by name", async () => {
    const quickwit = fake();
    await searchTenant(quickwit, "traces", scope, { maxHits: 5, startTimestamp: 1, endTimestamp: 2 });
    expect(quickwit.search).toHaveBeenCalledWith("telemetry-traces", {
      maxHits: 5,
      startTimestamp: 1,
      endTimestamp: 2,
      query: 'org_id:"orgone" AND project_id:"projone"',
    });
  });

  it("adds the filter inside the tenant scope so it cannot widen the search", async () => {
    const quickwit = fake();
    await searchTenant(quickwit, "logs", scope, { filter: 'level:"error" OR org_id:"other"' });
    expect(quickwit.search.mock.calls[0]?.[1].query).toBe(
      'org_id:"orgone" AND project_id:"projone" AND (level:"error" OR org_id:"other")',
    );
  });

  it("treats an empty or wildcard filter as no filter", async () => {
    const quickwit = fake();
    await searchTenant(quickwit, "logs", scope, { filter: "" });
    await searchTenant(quickwit, "logs", scope, { filter: "*" });
    for (const call of quickwit.search.mock.calls) expect(call[1].query).toBe('org_id:"orgone" AND project_id:"projone"');
  });

  it("refuses a missing organization or project instead of searching", () => {
    const quickwit = fake();
    expect(() => searchTenant(quickwit, "logs", { orgId: "", projectId: "p" })).toThrow("organization and a project");
    expect(() => searchTenant(quickwit, "logs", { orgId: "o", projectId: "" })).toThrow("organization and a project");
    expect(quickwit.search).not.toHaveBeenCalled();
  });

  it("passes aggregations and sorting through untouched", async () => {
    const quickwit = fake();
    const aggregations = { a: { terms: { field: "service" } } };
    await searchTenant(quickwit, "requests", scope, { aggregations, sortBy: ["timestamp:desc"], maxHits: 0 });
    expect(quickwit.search.mock.calls[0]?.[1]).toMatchObject({ aggregations, sortBy: ["timestamp:desc"], maxHits: 0 });
  });
});

describe("searchOrg", () => {
  it("scopes the query to the organization only and picks the index by name", async () => {
    const quickwit = fake();
    await searchOrg(quickwit, "metrics", "orgone", { maxHits: 0 });
    expect(quickwit.search).toHaveBeenCalledWith("telemetry-metrics", {
      maxHits: 0,
      query: 'org_id:"orgone"',
    });
  });

  it("keeps the filter inside the organization scope so it cannot widen the search", async () => {
    const quickwit = fake();
    await searchOrg(quickwit, "metrics", "orgone", { filter: 'name:"a" OR org_id:"other"' });
    expect(quickwit.search.mock.calls[0]?.[1].query).toBe('org_id:"orgone" AND (name:"a" OR org_id:"other")');
  });

  it("refuses a missing organization instead of searching everything", () => {
    const quickwit = fake();
    expect(() => searchOrg(quickwit, "metrics", "")).toThrow("organization");
    expect(quickwit.search).not.toHaveBeenCalled();
  });
});
