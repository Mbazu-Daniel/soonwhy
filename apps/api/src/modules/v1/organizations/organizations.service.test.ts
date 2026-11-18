import { ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authApi = vi.hoisted(() => ({
  listOrganizations: vi.fn(),
  createOrganization: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
  listMembers: vi.fn(),
  createInvitation: vi.fn(),
  listInvitations: vi.fn(),
  cancelInvitation: vi.fn(),
  updateMemberRole: vi.fn(),
}));

vi.mock("../../../common/config/better-auth.config", () => ({ auth: { api: authApi } }));

import { OrganizationsService } from "./organizations.service";

function build(overrides: Record<string, unknown> = {}) {
  const repository = {
    getOrganizationById: vi.fn().mockResolvedValue({ id: "o1", slug: "acme" }),
    getOrganizationBySlug: vi.fn().mockResolvedValue(undefined),
    getActiveOrganizationIds: vi.fn().mockResolvedValue([]),
    updateOrganization: vi.fn().mockResolvedValue({ id: "o1" }),
    deleteOrganization: vi.fn().mockResolvedValue({ deleted: true }),
    getMemberByUserId: vi.fn().mockResolvedValue({ id: "m1", userId: "u1" }),
    getMemberById: vi.fn().mockResolvedValue({ id: "m2", userId: "u2" }),
    updateMember: vi.fn().mockResolvedValue({ id: "m1" }),
    getInvitationPublicIdsByIds: vi.fn().mockResolvedValue(new Map()),
    getInvitationByPublicId: vi.fn().mockResolvedValue({ id: "inv-internal", organizationId: "o1" }),
    ...overrides,
  };
  const projects = { createProject: vi.fn().mockResolvedValue({ id: "p1" }) };
  return { repository, projects, service: new OrganizationsService(repository as never, projects as never) };
}

describe("OrganizationsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reading", () => {
    it("reports a missing organization as not found", async () => {
      const { service } = build({ getOrganizationById: vi.fn().mockResolvedValue(undefined) });
      await expect(service.getOrganizationById("o1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("reports a deleted organization as not found when read by slug", async () => {
      const { service } = build({ getOrganizationBySlug: vi.fn().mockResolvedValue({ id: "o1", deletedAt: new Date() }) });
      await expect(service.getOrganizationBySlug("acme")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lists only the user's organizations that are still active", async () => {
      authApi.listOrganizations.mockResolvedValue([{ id: "o1" }, { id: "o2" }, { id: "o3" }]);
      const { service, repository } = build({ getActiveOrganizationIds: vi.fn().mockResolvedValue(["o1", "o3"]) });
      await expect(service.getOrganizationsForUser("Bearer t")).resolves.toEqual([{ id: "o1" }, { id: "o3" }]);
      expect(repository.getActiveOrganizationIds).toHaveBeenCalledWith(["o1", "o2", "o3"]);
      expect(authApi.listOrganizations).toHaveBeenCalledWith({ headers: { authorization: "Bearer t" } });
    });
  });

  describe("createOrganization", () => {
    it("refuses a slug that is already taken", async () => {
      const { service } = build({ getOrganizationBySlug: vi.fn().mockResolvedValue({ id: "o9" }) });
      await expect(service.createOrganization("u1", { name: "Acme", slug: "acme" })).rejects.toBeInstanceOf(ConflictException);
      expect(authApi.createOrganization).not.toHaveBeenCalled();
    });

    it("creates the organization for the user and a default project", async () => {
      authApi.createOrganization.mockResolvedValue({ organization: { id: "o1" } });
      const { service, projects } = build();
      await service.createOrganization("u1", { name: "Acme", slug: "acme" }, "Bearer t");
      expect(authApi.createOrganization).toHaveBeenCalledWith({ headers: { authorization: "Bearer t" }, body: { name: "Acme", slug: "acme", userId: "u1" } });
      expect(projects.createProject).toHaveBeenCalledWith({ organizationId: "o1", name: "Default", slug: "default" });
    });

    it("still returns the organization when the default project cannot be created", async () => {
      authApi.createOrganization.mockResolvedValue({ organization: { id: "o1" } });
      const { service, projects } = build();
      projects.createProject.mockRejectedValue(new Error("db down"));
      await expect(service.createOrganization("u1", { name: "Acme", slug: "acme" })).resolves.toEqual({ organization: { id: "o1" } });
    });

    it("creates no default project when the auth provider returns no organization id", async () => {
      authApi.createOrganization.mockResolvedValue({});
      const { service, projects } = build();
      await service.createOrganization("u1", { name: "Acme", slug: "acme" });
      expect(projects.createProject).not.toHaveBeenCalled();
    });
  });

  describe("updateOrganization and deleteOrganization", () => {
    it("reports a missing organization as not found", async () => {
      const { service } = build({ getOrganizationById: vi.fn().mockResolvedValue(undefined) });
      await expect(service.updateOrganization("o1", { name: "x" })).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.deleteOrganization("o1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses a new slug that another organization uses", async () => {
      const { service, repository } = build({ getOrganizationBySlug: vi.fn().mockResolvedValue({ id: "o9" }) });
      await expect(service.updateOrganization("o1", { slug: "taken" })).rejects.toBeInstanceOf(ConflictException);
      expect(repository.updateOrganization).not.toHaveBeenCalled();
    });

    it("does not look the slug up again when it is unchanged", async () => {
      const { service, repository } = build();
      await service.updateOrganization("o1", { slug: "acme", name: "Acme Inc" });
      expect(repository.getOrganizationBySlug).not.toHaveBeenCalled();
      expect(repository.updateOrganization).toHaveBeenCalledWith("o1", { slug: "acme", name: "Acme Inc" });
    });

    it("deletes an existing organization", async () => {
      const { service, repository } = build();
      await service.deleteOrganization("o1");
      expect(repository.deleteOrganization).toHaveBeenCalledWith("o1");
    });
  });

  describe("members", () => {
    it("adds a member with the role as a list and defaults to member", async () => {
      authApi.addMember.mockResolvedValue({ id: "m2" });
      const { service } = build();
      await service.addMemberToOrganization("o1", "u2", undefined, "Bearer t");
      expect(authApi.addMember).toHaveBeenCalledWith({ headers: { authorization: "Bearer t" }, body: { userId: "u2", role: ["member"], organizationId: "o1" } });
    });

    it("removes a member by member id and refuses one who is not in the organization", async () => {
      authApi.removeMember.mockResolvedValue({ removed: true });
      const { service, repository } = build();
      await service.removeMemberFromOrganization("o1", "u1", "Bearer t");
      expect(repository.getMemberByUserId).toHaveBeenCalledWith("o1", "u1");
      expect(authApi.removeMember).toHaveBeenCalledWith({ headers: { authorization: "Bearer t" }, body: { memberIdOrEmail: "m1", organizationId: "o1" } });

      const missing = build({ getMemberByUserId: vi.fn().mockResolvedValue(undefined) });
      await expect(missing.service.removeMemberFromOrganization("o1", "ghost")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns an empty list when the auth provider returns no members", async () => {
      authApi.listMembers.mockResolvedValue(undefined);
      const { service } = build();
      await expect(service.getMembersOfOrganization("o1")).resolves.toEqual([]);
    });

    it("changes a member's role in the organization", async () => {
      authApi.updateMemberRole.mockResolvedValue({ id: "m2" });
      const { service } = build();
      await service.updateMemberRole("o1", "m2", "admin", "Bearer t");
      expect(authApi.updateMemberRole).toHaveBeenCalledWith({ headers: { authorization: "Bearer t" }, body: { memberId: "m2", role: "admin", organizationId: "o1" } });
    });

    it("renames the caller's own member row and refuses a user who is not a member", async () => {
      const { service, repository } = build();
      await service.updateMemberProfile("o1", "u1", "Ada");
      expect(repository.updateMember).toHaveBeenCalledWith("o1", "m1", { name: "Ada" });

      const missing = build({ getMemberByUserId: vi.fn().mockResolvedValue(undefined) });
      await expect(missing.service.updateMemberProfile("o1", "u9", "Ada")).rejects.toBeInstanceOf(NotFoundException);
      expect(missing.repository.updateMember).not.toHaveBeenCalled();
    });
  });

  describe("invitations", () => {
    it("normalizes the invited email", async () => {
      authApi.createInvitation.mockResolvedValue({ id: "inv" });
      const { service } = build();
      await service.createInvitation("o1", "  New.User@Example.COM ", "member", "Bearer t");
      expect(authApi.createInvitation).toHaveBeenCalledWith({ headers: { authorization: "Bearer t" }, body: { email: "new.user@example.com", role: "member", organizationId: "o1" } });
    });

    it("lists pending invitations under their public ids and drops those without one", async () => {
      authApi.listInvitations.mockResolvedValue([
        { id: "a", status: "pending" },
        { id: "b", status: "accepted" },
        { id: "c" },
        { id: "d", status: "pending" },
      ]);
      const { service, repository } = build({ getInvitationPublicIdsByIds: vi.fn().mockResolvedValue(new Map([["a", "pub-a"], ["c", "pub-c"]])) });
      await expect(service.listInvitations("o1")).resolves.toEqual([
        { id: "pub-a", status: "pending" },
        { id: "pub-c" },
      ]);
      expect(repository.getInvitationPublicIdsByIds).toHaveBeenCalledWith(["a", "c", "d"]);
    });

    it("lists nothing when the auth provider does not return a list", async () => {
      authApi.listInvitations.mockResolvedValue(undefined);
      const { service } = build();
      await expect(service.listInvitations("o1")).resolves.toEqual([]);
    });

    it("cancels an invitation of the organization by its internal id", async () => {
      authApi.cancelInvitation.mockResolvedValue({ cancelled: true });
      const { service } = build();
      await service.cancelInvitation("o1", "pub-1", "Bearer t");
      expect(authApi.cancelInvitation).toHaveBeenCalledWith({ headers: { authorization: "Bearer t" }, body: { invitationId: "inv-internal" } });
    });

    it("refuses to cancel an invitation that is unknown or belongs to another organization", async () => {
      const unknown = build({ getInvitationByPublicId: vi.fn().mockResolvedValue(undefined) });
      await expect(unknown.service.cancelInvitation("o1", "pub-1")).rejects.toBeInstanceOf(NotFoundException);
      const foreign = build({ getInvitationByPublicId: vi.fn().mockResolvedValue({ id: "inv", organizationId: "o2" }) });
      await expect(foreign.service.cancelInvitation("o1", "pub-1")).rejects.toBeInstanceOf(NotFoundException);
      expect(authApi.cancelInvitation).not.toHaveBeenCalled();
    });
  });

  describe("transferOrganization", () => {
    it("refuses a target who is not a member", async () => {
      const { service } = build({ getMemberById: vi.fn().mockResolvedValue(undefined) });
      await expect(service.transferOrganization("o1", "u1", "m9")).rejects.toBeInstanceOf(NotFoundException);
      expect(authApi.updateMemberRole).not.toHaveBeenCalled();
    });

    it("refuses to transfer the organization to its current owner", async () => {
      const { service } = build({ getMemberById: vi.fn().mockResolvedValue({ id: "m1", userId: "u1" }) });
      await expect(service.transferOrganization("o1", "u1", "m1")).rejects.toBeInstanceOf(ConflictException);
      expect(authApi.updateMemberRole).not.toHaveBeenCalled();
    });

    it("makes the target the owner first, then demotes the previous owner to admin", async () => {
      authApi.updateMemberRole.mockResolvedValue({});
      const { service } = build();
      await expect(service.transferOrganization("o1", "u1", "m2", "Bearer t")).resolves.toEqual({ success: true });
      expect(authApi.updateMemberRole.mock.calls).toEqual([
        [{ headers: { authorization: "Bearer t" }, body: { memberId: "m2", role: "owner", organizationId: "o1" } }],
        [{ headers: { authorization: "Bearer t" }, body: { memberId: "m1", role: "admin", organizationId: "o1" } }],
      ]);
    });

    it("does not demote anyone when the previous owner has no member row", async () => {
      authApi.updateMemberRole.mockResolvedValue({});
      const { service } = build({ getMemberByUserId: vi.fn().mockResolvedValue(undefined) });
      await service.transferOrganization("o1", "u1", "m2");
      expect(authApi.updateMemberRole).toHaveBeenCalledTimes(1);
    });
  });
});
