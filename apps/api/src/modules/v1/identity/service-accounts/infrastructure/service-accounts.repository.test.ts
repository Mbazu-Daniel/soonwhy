import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbCalls, stepArgs, useFakeDb } from "../../../../../common/testing/fake-db";
import { ServiceAccountsRepository } from "./service-accounts.repository";

vi.mock("../../../../../common/db", async () => {
  const { delegatingDb } = await import("../../../../../common/testing/fake-db");
  return { db: delegatingDb };
});

describe("ServiceAccountsRepository", () => {
  const repository = new ServiceAccountsRepository();

  beforeEach(() => {
    useFakeDb();
  });

  it("creates an account in the organization with null optional fields", async () => {
    useFakeDb({ insert: [[{ id: "sa1" }]] });
    await expect(repository.create({ orgId: "o1", name: "ci" })).resolves.toEqual({ id: "sa1" });
    expect(stepArgs(dbCalls("insert")[0]!, "values")![0]).toEqual({ organizationId: "o1", name: "ci", description: null, createdBy: null });
  });

  it("returns nothing when an account with the same name exists", async () => {
    useFakeDb({ insert: [[]] });
    await expect(repository.create({ orgId: "o1", name: "ci" })).resolves.toBeUndefined();
  });

  it("stamps the disable time and clears it again on enable", async () => {
    useFakeDb({ update: [[{ id: "sa1" }], [{ id: "sa1" }]] });
    await repository.setDisabled("o1", "sa1", true);
    await repository.setDisabled("o1", "sa1", false);
    const [disable, enable] = dbCalls("update").map((call) => stepArgs(call, "set")![0] as { disabledAt: Date | null });
    expect(disable?.disabledAt).toBeInstanceOf(Date);
    expect(enable?.disabledAt).toBeNull();
  });

  it("reports whether a delete removed a row", async () => {
    useFakeDb({ delete: [[{ id: "sa1" }], []] });
    await expect(repository.remove("o1", "sa1")).resolves.toBe(true);
    await expect(repository.remove("o1", "missing")).resolves.toBe(false);
  });

  it("finds an account only by id and organization together", async () => {
    useFakeDb({ select: [[], [{ id: "sa1" }]] });
    await expect(repository.find("o2", "sa1")).resolves.toBeUndefined();
    await expect(repository.find("o1", "sa1")).resolves.toEqual({ id: "sa1" });
  });

  it("looks up no projects for an empty list", async () => {
    await expect(repository.projectIds("o1", [])).resolves.toEqual([]);
    expect(dbCalls("select")).toHaveLength(0);
  });

  it("returns only the project ids found in the organization", async () => {
    useFakeDb({ select: [[{ id: "p1" }]] });
    await expect(repository.projectIds("o1", ["p1", "p-other"])).resolves.toEqual(["p1"]);
  });

  it("lists keys without their hash", async () => {
    useFakeDb({ select: [[{ id: "k1", prefix: "soonwhy_abc" }]] });
    await repository.keys("sa1");
    const projection = stepArgs(dbCalls("select")[0]!, "select")![0] as Record<string, unknown>;
    expect(Object.keys(projection)).toEqual(["id", "projectId", "name", "prefix", "scopes", "expiresAt", "lastUsedAt", "createdAt"]);
  });
});
