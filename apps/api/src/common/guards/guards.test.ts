import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFakeDb } from "../testing/fake-db";
import { TenantGuard } from "../middleware/tenant-context.guard";
import { OwnerOrAdminGuard } from "./owner-or-admin.guard";
import { PlatformAdminGuard, platformRoleFor, SuperAdminGuard } from "./platform-admin.guard";

vi.mock("../db", async () => {
  const { delegatingDb } = await import("../testing/fake-db");
  return { db: delegatingDb };
});

function contextFor(request: Record<string, unknown>) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as never;
}

describe("TenantGuard", () => {
  it("lets a request with an organization through", () => {
    expect(new TenantGuard().canActivate(contextFor({ orgId: "org-1" }))).toBe(true);
  });

  it("rejects a request without an organization", () => {
    expect(() => new TenantGuard().canActivate(contextFor({}))).toThrow(UnauthorizedException);
  });
});

describe("OwnerOrAdminGuard", () => {
  const guard = new OwnerOrAdminGuard();

  it.each(["owner", "admin"])("lets a %s through", (userRole) => {
    expect(guard.canActivate(contextFor({ userRole }))).toBe(true);
  });

  it.each(["member", "viewer", "", "Owner"])("rejects the role %j", (userRole) => {
    expect(() => guard.canActivate(contextFor({ userRole }))).toThrow(ForbiddenException);
  });

  it("treats a missing role as a plain member", () => {
    expect(() => guard.canActivate(contextFor({}))).toThrow(ForbiddenException);
  });
});

describe("platform guards", () => {
  beforeEach(() => {
    useFakeDb();
  });

  it("reads no role for an anonymous caller without querying", async () => {
    await expect(platformRoleFor(undefined)).resolves.toBe("none");
  });

  it.each([
    ["admin", "admin"],
    ["super_admin", "super_admin"],
    ["none", "none"],
    ["root", "none"],
    [null, "none"],
  ])("maps the stored platform role %j to %s", async (stored, expected) => {
    useFakeDb({ select: [[{ platformRole: stored }]] });
    await expect(platformRoleFor("user-1")).resolves.toBe(expected);
  });

  it("maps an unknown user to no role", async () => {
    useFakeDb({ select: [[]] });
    await expect(platformRoleFor("ghost")).resolves.toBe("none");
  });

  it("asks an anonymous caller to sign in", async () => {
    await expect(new PlatformAdminGuard().canActivate(contextFor({}))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(new SuperAdminGuard().canActivate(contextFor({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("keeps a signed in customer out of the platform admin area", async () => {
    useFakeDb({ select: [[{ platformRole: "none" }]] });
    await expect(new PlatformAdminGuard().canActivate(contextFor({ user: { id: "u1" } }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(["admin", "super_admin"])("lets platform %s into the platform admin area", async (platformRole) => {
    useFakeDb({ select: [[{ platformRole }]] });
    await expect(new PlatformAdminGuard().canActivate(contextFor({ user: { id: "u1" } }))).resolves.toBe(true);
  });

  it("lets only a super admin through the super admin guard", async () => {
    useFakeDb({ select: [[{ platformRole: "admin" }]] });
    await expect(new SuperAdminGuard().canActivate(contextFor({ user: { id: "u1" } }))).rejects.toBeInstanceOf(ForbiddenException);
    useFakeDb({ select: [[{ platformRole: "super_admin" }]] });
    await expect(new SuperAdminGuard().canActivate(contextFor({ user: { id: "u1" } }))).resolves.toBe(true);
  });
});
