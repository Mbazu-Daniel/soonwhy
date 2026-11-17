import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const limit = vi.fn();

vi.mock("../config/better-auth.config", () => ({ auth: { api: { getSession } } }));
vi.mock("../db", () => ({
  db: {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit }) }) }) }),
    execute: vi.fn(),
  },
}));

const { TenantContextMiddleware } = await import("./tenant-context.middleware");

const request = (extra: Record<string, unknown> = {}) =>
  ({
    headers: { authorization: "Bearer token" },
    originalUrl: "/api/v1/organization/01a1c62c-157e-7123-bb7b-677072297070/projects",
    ...extra,
  }) as never;

describe("TenantContextMiddleware", () => {
  beforeEach(() => {
    getSession.mockReset();
    limit.mockReset();
  });

  it("rejects a non-member with 403 so the browser keeps its session", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    limit.mockResolvedValue([]);
    await expect(new TenantContextMiddleware().use(request(), {} as never, vi.fn())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a deleted organization with 403", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    limit.mockResolvedValue([{ role: "owner", deletedAt: new Date() }]);
    await expect(new TenantContextMiddleware().use(request(), {} as never, vi.fn())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets an unauthenticated request through for the guards to answer", async () => {
    const next = vi.fn();
    await new TenantContextMiddleware().use({ headers: {} } as never, {} as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
