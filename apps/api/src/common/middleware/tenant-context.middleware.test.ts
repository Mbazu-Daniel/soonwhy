import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TenantContextMiddleware } from "./tenant-context.middleware";

const { getSession, limit } = vi.hoisted(() => ({ getSession: vi.fn(), limit: vi.fn() }));

vi.mock("../config/better-auth.config", () => ({ auth: { api: { getSession } } }));
vi.mock("../db", () => ({
  db: {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit }) }), where: () => ({ limit }) }) }),
    execute: vi.fn(),
  },
}));



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

  it("rejects a project that belongs to another organization with 404", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    limit.mockResolvedValueOnce([{ role: "member", deletedAt: null }]).mockResolvedValueOnce([]);
    const req = request({ originalUrl: "/api/v1/organization/org-a/projects/foreign-project/services" });
    await expect(new TenantContextMiddleware().use(req, {} as never, vi.fn())).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a foreign projectId given as a query parameter", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    limit.mockResolvedValueOnce([{ role: "member", deletedAt: null }]).mockResolvedValueOnce([]);
    const req = request({ originalUrl: "/api/v1/organization/org-a/environments?projectId=foreign-project" });
    await expect(new TenantContextMiddleware().use(req, {} as never, vi.fn())).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lets a project of the organization through", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    limit.mockResolvedValueOnce([{ role: "member", deletedAt: null }]).mockResolvedValueOnce([{ id: "p1" }]);
    const next = vi.fn();
    const req = request({ originalUrl: "/api/v1/organization/org-a/projects/p1/services" });
    await new TenantContextMiddleware().use(req, {} as never, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("lets an unauthenticated request through for the guards to answer", async () => {
    const next = vi.fn();
    await new TenantContextMiddleware().use({ headers: {} } as never, {} as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
