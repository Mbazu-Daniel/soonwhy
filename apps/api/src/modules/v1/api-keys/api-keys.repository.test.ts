import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbCalls, stepArgs, useFakeDb } from "../../../common/testing/fake-db";
import { ApiKeysRepository } from "./api-keys.repository";

vi.mock("../../../common/db", async () => {
  const { delegatingDb } = await import("../../../common/testing/fake-db");
  return { db: delegatingDb };
});

describe("ApiKeysRepository", () => {
  const repository = new ApiKeysRepository();

  beforeEach(() => {
    useFakeDb();
  });

  describe("createApiKey", () => {
    async function create(data: Partial<Parameters<ApiKeysRepository["createApiKey"]>[0]> = {}) {
      useFakeDb({ insert: [[{ id: "k1", prefix: "ignored" }]] });
      const created = await repository.createApiKey({ projectId: "p1", name: "ci", scopes: ["ingest"], ...data });
      const stored = stepArgs(dbCalls("insert")[0]!, "values")![0] as Record<string, unknown>;
      return { created, stored };
    }

    it("returns a soonwhy key that is long enough to be unguessable", async () => {
      const { created } = await create();
      expect(created.key).toMatch(/^soonwhy_[A-Za-z0-9_-]{43}$/);
    });

    it("stores the sha256 of the key and never the key itself", async () => {
      const { created, stored } = await create();
      expect(stored.keyHash).toBe(createHash("sha256").update(created.key).digest("hex"));
      expect(Object.values(stored)).not.toContain(created.key);
    });

    it("stores the first fifteen characters as the display prefix", async () => {
      const { created, stored } = await create();
      expect(stored.prefix).toBe(created.key.slice(0, 15));
    });

    it("generates a different key every time", async () => {
      const first = await create();
      const second = await create();
      expect(first.created.key).not.toBe(second.created.key);
      expect(first.stored.keyHash).not.toBe(second.stored.keyHash);
    });

    it("stores the project, scopes, expiry and service account", async () => {
      const expiresAt = new Date("2027-01-01T00:00:00.000Z");
      const { stored } = await create({ expiresAt, serviceAccountId: "sa1" });
      expect(stored).toMatchObject({ projectId: "p1", name: "ci", scopes: ["ingest"], expiresAt, serviceAccountId: "sa1" });
    });

    it("stores no expiry and no service account by default", async () => {
      const { stored } = await create();
      expect(stored).toMatchObject({ expiresAt: null, serviceAccountId: null });
    });
  });

  describe("getApiKeysByProjectId", () => {
    it("returns nothing for a project outside the organization", async () => {
      useFakeDb({ select: [undefined] });
      await expect(repository.getApiKeysByProjectId("p1", "o2")).resolves.toEqual([]);
      expect(dbCalls("select")).toHaveLength(1);
    });

    it("never returns the key hash", async () => {
      useFakeDb({ select: [{ id: "p1" }, [{ id: "k1", name: "ci", prefix: "soonwhy_abcdefg", keyHash: "deadbeef" }]] });
      const keys = await repository.getApiKeysByProjectId("p1", "o1");
      expect(keys).toEqual([{ id: "k1", name: "ci", prefix: "soonwhy_abcdefg" }]);
    });
  });

  describe("getApiKeyById", () => {
    it("returns the key when its project belongs to the organization", async () => {
      useFakeDb({ select: [[{ apiKey: { id: "k1" } }]] });
      await expect(repository.getApiKeyById("k1", "o1")).resolves.toEqual({ id: "k1" });
    });

    it("returns nothing when the project belongs to another organization", async () => {
      useFakeDb({ select: [[]] });
      await expect(repository.getApiKeyById("k1", "o2")).resolves.toBeUndefined();
    });
  });
});
