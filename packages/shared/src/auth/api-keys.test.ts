import { describe, expect, it, vi } from "vitest";
import { ApiKeyAuthenticator } from "./api-keys";

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
  const selects = vi.fn();
  const db = {
    select: () => (selects(), {
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            leftJoin: () => ({
              leftJoin: () => ({
                where: async () => (row ? [row] : []),
              }),
            }),
          }),
        }),
      }),
    }),
    update,
  };
  return { db: db as never, update, set, where, selects };
}

const BEARER = "Bearer soonwhy_test";

describe("ApiKeyAuthenticator.authenticate", () => {
  it("refuses a missing or malformed header without touching the database", async () => {
    const { db, update } = stubDb(validRow);
    const authenticator = new ApiKeyAuthenticator(db);
    for (const header of [undefined, "", "soonwhy_test", "Basic abc", "Bearer"]) {
      expect(await authenticator.authenticate(header), String(header)).toMatchObject({ ok: false, reason: "missing" });
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses an unknown key and does not record usage", async () => {
    const { db, update } = stubDb(undefined);
    expect(await new ApiKeyAuthenticator(db).authenticate(BEARER)).toMatchObject({ ok: false, reason: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses a key whose organization was deleted", async () => {
    const { db, update } = stubDb({ ...validRow, organizationDeletedAt: new Date() });
    expect(await new ApiKeyAuthenticator(db).authenticate(BEARER)).toMatchObject({ ok: false, reason: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses an expired key and does not record usage", async () => {
    const { db, update } = stubDb({ ...validRow, expiresAt: new Date(Date.now() - 1000) });
    expect(await new ApiKeyAuthenticator(db).authenticate(BEARER)).toMatchObject({ ok: false, reason: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses a key whose service account is disabled, and accepts one whose account is active", async () => {
    const disabled = stubDb({ ...validRow, serviceAccountId: "sa-1", serviceAccountDisabledAt: new Date() });
    expect(await new ApiKeyAuthenticator(disabled.db).authenticate(BEARER)).toMatchObject({ ok: false, reason: "invalid" });
    const active = stubDb({ ...validRow, serviceAccountId: "sa-1", serviceAccountDisabledAt: null });
    expect(await new ApiKeyAuthenticator(active.db).authenticate(BEARER)).toMatchObject({ ok: true, key: { projectId: "project-1" } });
  });

  it("returns the auth context for a valid key and records last_used_at", async () => {
    const { db, update, where } = stubDb(validRow);
    const auth = await new ApiKeyAuthenticator(db).authenticate(BEARER);
    expect(auth).toMatchObject({ ok: true, key: { projectId: "project-1", organizationId: "org-1", scopes: ["ingest"] } });
    expect(update).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("still returns the auth context when recording last_used_at fails", async () => {
    const { db } = stubDb(validRow, async () => {
      throw new Error("database unavailable");
    });
    expect(await new ApiKeyAuthenticator(db).authenticate(BEARER)).toMatchObject({ ok: true });
  });

  it("checks the scope only when one is required", async () => {
    const { db } = stubDb(validRow);
    const authenticator = new ApiKeyAuthenticator(db);
    expect(await authenticator.authenticate(BEARER, { scope: "ingest" })).toMatchObject({ ok: true });
    expect(await authenticator.authenticate(BEARER, { scope: "mcp:read" })).toMatchObject({ ok: false, reason: "scope" });
  });

  describe("caching", () => {
    it("looks a key up once per 30 seconds and writes last_used_at once per minute", async () => {
      vi.useFakeTimers();
      try {
        const { db, selects, update } = stubDb(validRow);
        const authenticator = new ApiKeyAuthenticator(db);
        for (let i = 0; i < 50; i++) await authenticator.authenticate(BEARER);
        expect(selects).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(31_000);
        await authenticator.authenticate(BEARER);
        expect(selects).toHaveBeenCalledTimes(2);
        expect(update).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(60_000);
        await authenticator.authenticate(BEARER);
        expect(update).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("still refuses a cached key once it has expired", async () => {
      vi.useFakeTimers();
      try {
        const { db } = stubDb({ ...validRow, expiresAt: new Date(Date.now() + 10_000) });
        const authenticator = new ApiKeyAuthenticator(db);
        expect(await authenticator.authenticate(BEARER)).toMatchObject({ ok: true });
        vi.advanceTimersByTime(11_000);
        expect(await authenticator.authenticate(BEARER)).toMatchObject({ ok: false, reason: "invalid" });
      } finally {
        vi.useRealTimers();
      }
    });

    it("remembers an unknown key only briefly", async () => {
      vi.useFakeTimers();
      try {
        const { db, selects } = stubDb(undefined);
        const authenticator = new ApiKeyAuthenticator(db);
        await authenticator.authenticate(BEARER);
        await authenticator.authenticate(BEARER);
        expect(selects).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(6_000);
        await authenticator.authenticate(BEARER);
        expect(selects).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
