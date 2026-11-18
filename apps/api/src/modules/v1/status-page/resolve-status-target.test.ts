import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";

const rows: unknown[][] = [];

vi.mock("../../../common/db", () => {
  const chain = () => {
    const node: Record<string, unknown> = {};
    for (const method of ["select", "from", "where"]) node[method] = () => node;
    node.limit = () => Promise.resolve(rows.shift() ?? []);
    return node;
  };
  return { db: chain() };
});

import { resolveStatusTarget } from "./resolve-status-target";

describe("resolveStatusTarget", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("resolves a project that has turned its status page on", async () => {
    rows.push([{ id: "org_1" }], [{ id: "proj_1" }], [{ statusPagePublic: true }]);
    await expect(resolveStatusTarget("acme", "api")).resolves.toEqual({ orgId: "org_1", projectId: "proj_1" });
  });

  it("answers not found when the project never turned it on", async () => {
    rows.push([{ id: "org_1" }], [{ id: "proj_1" }], []);
    await expect(resolveStatusTarget("acme", "api")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("answers not found when the project turned it off", async () => {
    rows.push([{ id: "org_1" }], [{ id: "proj_1" }], [{ statusPagePublic: false }]);
    await expect(resolveStatusTarget("acme", "api")).rejects.toBeInstanceOf(NotFoundException);
  });
});
