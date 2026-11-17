import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbCalls, stepArgs, useFakeDb } from "../../../common/testing/fake-db";
import { validateBody } from "../../../common/testing/route-schema";

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
}));

vi.mock("../../../common/config/better-auth.config", () => ({ auth: { api: {} } }));
vi.mock("../../../common/audit-logs", () => ({ recordAuditEvent: mocks.audit }));
vi.mock("../../../common/db", async () => {
  const { delegatingDb } = await import("../../../common/testing/fake-db");
  return { db: delegatingDb };
});

import { OrganizationController, OrganizationsController } from "./organizations.controller";

const REQUEST = { ip: "203.0.113.9", headers: { "user-agent": "vitest" } } as never;
const AUTHORIZATION = "Bearer token";

function service() {
  return {
    createOrganization: vi.fn().mockResolvedValue({ organization: { id: "org-new" } }),
    getOrganizationsForUser: vi.fn().mockResolvedValue([]),
    getOrganizationById: vi.fn().mockResolvedValue({ id: "org-1" }),
    updateOrganization: vi.fn().mockResolvedValue({ id: "org-1" }),
    deleteOrganization: vi.fn().mockResolvedValue({ deleted: true }),
    getMembersOfOrganization: vi.fn().mockResolvedValue([]),
    addMemberToOrganization: vi.fn().mockResolvedValue({ id: "m2" }),
    removeMemberFromOrganization: vi.fn().mockResolvedValue({ removed: true }),
    createInvitation: vi.fn().mockResolvedValue({ id: "inv-1" }),
    listInvitations: vi.fn().mockResolvedValue([]),
    cancelInvitation: vi.fn().mockResolvedValue({ cancelled: true }),
    updateMemberRole: vi.fn().mockResolvedValue({ id: "m2" }),
    updateMemberProfile: vi.fn().mockResolvedValue({ id: "m1" }),
    transferOrganization: vi.fn().mockResolvedValue({ success: true }),
  };
}

function memberOf(role: string, orgId = "org-1") {
  return { userId: "user-1", orgId, role };
}

function build() {
  const organizations = service();
  return { organizations, controller: new OrganizationController(organizations as never) };
}

type Mutation = {
  name: string;
  allowed: string[];
  run: (controller: OrganizationController, member: ReturnType<typeof memberOf>) => Promise<unknown>;
  service: keyof ReturnType<typeof service>;
  audit: string;
};

const MUTATIONS: Mutation[] = [
  { name: "update the organization", allowed: ["owner", "admin"], service: "updateOrganization", audit: "organization.update", run: (c, m) => c.updateOrganization("org-1", { name: "New" } as never, m, REQUEST) },
  { name: "delete the organization", allowed: ["owner"], service: "deleteOrganization", audit: "organization.delete", run: (c, m) => c.deleteOrganization("org-1", m, REQUEST) },
  { name: "add a member", allowed: ["owner", "admin"], service: "addMemberToOrganization", audit: "member.create", run: (c, m) => c.addMemberToOrganization("org-1", { userId: "u2", role: "member" }, AUTHORIZATION, m, REQUEST) },
  { name: "remove a member", allowed: ["owner", "admin"], service: "removeMemberFromOrganization", audit: "member.delete", run: (c, m) => c.removeMemberFromOrganization("org-1", "u2", AUTHORIZATION, m, REQUEST) },
  { name: "invite a member", allowed: ["owner", "admin"], service: "createInvitation", audit: "invitation.create", run: (c, m) => c.createInvitation("org-1", { email: "a@example.com", role: "member" }, AUTHORIZATION, m, REQUEST) },
  { name: "cancel an invitation", allowed: ["owner", "admin"], service: "cancelInvitation", audit: "invitation.cancel", run: (c, m) => c.cancelInvitation("org-1", "inv-1", AUTHORIZATION, m, REQUEST) },
  { name: "change a member's role", allowed: ["owner", "admin"], service: "updateMemberRole", audit: "member.role_update", run: (c, m) => c.updateMemberRole("org-1", "m2", { role: "admin" }, AUTHORIZATION, m, REQUEST) },
  { name: "transfer the organization", allowed: ["owner"], service: "transferOrganization", audit: "organization.transfer", run: (c, m) => c.transferOrganization("org-1", { memberId: "m2" }, AUTHORIZATION, m, REQUEST) },
];

describe("OrganizationController permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFakeDb();
  });

  for (const mutation of MUTATIONS) {
    const refused = ["owner", "admin", "member"].filter((role) => !mutation.allowed.includes(role));

    it.each(refused)(`rejects a ${"%s"} who tries to ${mutation.name}`, async (role) => {
      const { controller, organizations } = build();
      await expect(mutation.run(controller, memberOf(role))).rejects.toBeInstanceOf(ForbiddenException);
      expect(organizations[mutation.service]).not.toHaveBeenCalled();
      expect(mocks.audit).not.toHaveBeenCalled();
    });

    it.each(mutation.allowed)(`lets a ${"%s"} ${mutation.name} and audits it`, async (role) => {
      const { controller, organizations } = build();
      await mutation.run(controller, memberOf(role));
      expect(organizations[mutation.service]).toHaveBeenCalledTimes(1);
      expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", organizationId: "org-1", action: mutation.audit, ipAddress: "203.0.113.9", userAgent: "vitest" }));
    });

    it(`refuses to ${mutation.name} for an organization the caller is not acting in`, async () => {
      const { controller, organizations } = build();
      await expect(mutation.run(controller, memberOf("owner", "org-other"))).rejects.toThrow("Organization context does not match the resource");
      expect(organizations[mutation.service]).not.toHaveBeenCalled();
    });
  }

  it("lets a member see the organization, its members and rename themselves", async () => {
    const { controller, organizations } = build();
    await controller.getOrganizationById("org-1", memberOf("member"));
    await controller.getMembersOfOrganization("org-1", AUTHORIZATION, memberOf("member"));
    await controller.updateMemberProfile("org-1", { name: "Ada" }, memberOf("member"), REQUEST);
    expect(organizations.getOrganizationById).toHaveBeenCalledWith("org-1");
    expect(organizations.getMembersOfOrganization).toHaveBeenCalledWith("org-1", AUTHORIZATION);
    expect(organizations.updateMemberProfile).toHaveBeenCalledWith("org-1", "user-1", "Ada");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "member.profile_update", metadata: { fields: ["name"] } }));
  });

  it("keeps the invitation list from a plain member", async () => {
    const { controller, organizations } = build();
    await expect(controller.listInvitations("org-1", AUTHORIZATION, memberOf("member"))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.listInvitations("org-1", AUTHORIZATION, memberOf("admin"))).resolves.toEqual([]);
    expect(organizations.listInvitations).toHaveBeenCalledTimes(1);
  });

  it("does not read or change another organization even when the path says so", async () => {
    const { controller, organizations } = build();
    await expect(controller.getOrganizationById("org-other", memberOf("owner"))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.getMembersOfOrganization("org-other", AUTHORIZATION, memberOf("owner"))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.updateMemberProfile("org-other", { name: "Ada" }, memberOf("member"), REQUEST)).rejects.toBeInstanceOf(ForbiddenException);
    expect(organizations.getOrganizationById).not.toHaveBeenCalled();
    expect(organizations.getMembersOfOrganization).not.toHaveBeenCalled();
    expect(organizations.updateMemberProfile).not.toHaveBeenCalled();
  });

  it("passes the role and the caller's authorization to the member and invitation calls", async () => {
    const { controller, organizations } = build();
    await controller.addMemberToOrganization("org-1", { userId: "u2", role: "admin" }, AUTHORIZATION, memberOf("owner"), REQUEST);
    await controller.createInvitation("org-1", { email: "a@example.com", role: "admin" }, AUTHORIZATION, memberOf("admin"), REQUEST);
    expect(organizations.addMemberToOrganization).toHaveBeenCalledWith("org-1", "u2", "admin", AUTHORIZATION);
    expect(organizations.createInvitation).toHaveBeenCalledWith("org-1", "a@example.com", "admin", AUTHORIZATION);
  });

  it("reads the audit log of the caller's organization only", async () => {
    const { controller } = build();
    useFakeDb({ select: [[{ id: "a1" }]] });
    await expect(controller.getAuditLogs("org-1", memberOf("member"), { limit: 10, offset: 5 })).resolves.toEqual([{ id: "a1" }]);
    expect(stepArgs(dbCalls("select")[0]!, "limit")).toEqual([10]);
    expect(stepArgs(dbCalls("select")[0]!, "offset")).toEqual([5]);
    await expect(controller.getAuditLogs("org-other", memberOf("member"), { limit: 10, offset: 0 })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("OrganizationController request bodies", () => {
  it.each(["member", "admin"])("accepts %s when adding a member", async (role) => {
    await expect(validateBody(OrganizationController, "addMemberToOrganization", { userId: "u2", role })).resolves.toEqual({ valid: true });
  });

  it("defaults the role to member when adding a member", async () => {
    await expect(validateBody(OrganizationController, "addMemberToOrganization", { userId: "u2" })).resolves.toEqual({ valid: true });
  });

  it.each(["owner", "superuser", ""])("refuses the role %j when adding a member, so an admin cannot create an owner", async (role) => {
    await expect(validateBody(OrganizationController, "addMemberToOrganization", { userId: "u2", role })).resolves.toEqual({ valid: false });
  });

  it("refuses an add member request without a user", async () => {
    await expect(validateBody(OrganizationController, "addMemberToOrganization", { role: "member" })).resolves.toEqual({ valid: false });
  });

  it.each(["updateMemberRole", "createInvitation"])("refuses the owner role on %s", async (handler) => {
    await expect(validateBody(OrganizationController, handler, { email: "a@example.com", role: "owner" })).resolves.toEqual({ valid: false });
  });
});

describe("OrganizationsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks an anonymous caller to sign in before creating or listing organizations", async () => {
    const organizations = service();
    const controller = new OrganizationsController(organizations as never);
    await expect(controller.createOrganization(null, AUTHORIZATION, { name: "Acme", slug: "acme" } as never, REQUEST)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.getOrganizationsForUser(null, AUTHORIZATION)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(organizations.createOrganization).not.toHaveBeenCalled();
    expect(organizations.getOrganizationsForUser).not.toHaveBeenCalled();
  });

  it("creates an organization for the signed in user and audits it", async () => {
    const organizations = service();
    const controller = new OrganizationsController(organizations as never);
    const user = { id: "user-1", email: "a@example.com", name: "A", image: null, emailVerified: true };
    await controller.createOrganization(user, AUTHORIZATION, { name: "Acme", slug: "acme" } as never, REQUEST);
    expect(organizations.createOrganization).toHaveBeenCalledWith("user-1", { name: "Acme", slug: "acme" }, AUTHORIZATION);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", organizationId: "org-new", action: "organization.create", metadata: { name: "Acme", slug: "acme" } }));
  });
});
