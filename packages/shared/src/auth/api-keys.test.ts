import { describe, expect, it, vi } from "vitest";
import { ApiKeysService } from "./api-keys";

const validRow = {
  id: "key-1",
  projectId: "project-1",
  scopes: ["ingest"],
  expiresAt: null,
  organizationId: "org-1",
  maxAttributeCount: 100,
  maxAttributeValueLength: 4096,
};

function stubDb(
  row: Record<string, unknown> | undefined,
  whereImpl: () => Promise<unknown> = async () => undefined,
) {
  const where = vi.fn(whereImpl);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const db = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          leftJoin: () => ({
            where: async () => (row ? [row] : []),
          }),
        }),
      }),
    }),
    update,
  };
  return { db: db as never, update, set, where };
}

describe("ApiKeysService.validateKey", () => {
  it("returns the auth context for a valid key and records last_used_at", async () => {
    const { db, update, where } = stubDb(validRow);
    const service = new ApiKeysService(db);

    const auth = await service.validateKey("soonwhy_test");

    expect(auth).toMatchObject({
      projectId: "project-1",
      organizationId: "org-1",
      scopes: ["ingest"],
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("does not record last_used_at for an expired key", async () => {
    const { db, update } = stubDb({
      ...validRow,
      expiresAt: new Date(Date.now() - 1000),
    });
    const service = new ApiKeysService(db);

    await expect(service.validateKey("soonwhy_test")).resolves.toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });

  it("returns undefined for an unknown key and does not update", async () => {
    const { db, update } = stubDb(undefined);
    const service = new ApiKeysService(db);

    await expect(service.validateKey("soonwhy_test")).resolves.toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });

  it("still returns the auth context when recording last_used_at fails", async () => {
    const { db } = stubDb(validRow, async () => {
      throw new Error("database unavailable");
    });
    const service = new ApiKeysService(db);

    await expect(
      service.validateKey("soonwhy_test"),
    ).resolves.toMatchObject({ projectId: "project-1" });
  });
});
