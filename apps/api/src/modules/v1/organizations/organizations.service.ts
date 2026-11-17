import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { OrganizationsRepository } from "./organizations.repository";
import { ProjectsRepository } from "../projects/projects.repository";
import { CreateOrganizationInput, UpdateOrganizationInput } from "./dto";
import { auth } from "../../../common/config/better-auth.config";
import type { OrganizationAuthApi } from "./organization-auth-api.types";

const authApi = auth.api as unknown as OrganizationAuthApi;
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly projectsRepository: ProjectsRepository,
  ) {}

  async getOrganizationById(id: string) {
    const org = await this.organizationsRepository.getOrganizationById(id);
    if (!org) {
      throw new NotFoundException("Organization not found");
    }
    return org;
  }

  async getOrganizationBySlug(slug: string) {
    const org = await this.organizationsRepository.getOrganizationBySlug(slug);
    if (!org || org.deletedAt) {
      throw new NotFoundException("Organization not found");
    }
    return org;
  }

  async getOrganizationsForUser(authorization?: string) {
    const organizations = await authApi.listOrganizations({
      headers: authorization ? { authorization } : {},
    });
    const activeIds = await this.organizationsRepository.getActiveOrganizationIds(
      organizations.map((organization: { id: string }) => organization.id),
    );
    const active = new Set(activeIds);
    return organizations.filter(
      (organization: { id: string }) => active.has(organization.id),
    );
  }

  async createOrganization(
    userId: string,
    input: CreateOrganizationInput,
    authorization?: string,
  ) {
    const existing = await this.organizationsRepository.getOrganizationBySlug(
      input.slug,
    );
    if (existing) {
      throw new ConflictException("Organization slug already exists");
    }

    const result = await authApi.createOrganization({
      headers: authorization ? { authorization } : {},
      body: {
        name: input.name,
        slug: input.slug,
        userId,
      },
    });

    const organization =
      result?.organization ?? result?.data?.organization ?? result;
    const organizationId = organization?.id;

    if (organizationId) {
      try {
        await this.projectsRepository.createProject({
          organizationId,
          name: "Default",
          slug: "default",
        });
      } catch {
      }
    }

    return result;
  }

  async updateOrganization(id: string, input: UpdateOrganizationInput) {
    const org = await this.organizationsRepository.getOrganizationById(id);
    if (!org) {
      throw new NotFoundException("Organization not found");
    }

    if (input.slug && input.slug !== org.slug) {
      const existing = await this.organizationsRepository.getOrganizationBySlug(
        input.slug,
      );
      if (existing) {
        throw new ConflictException("Organization slug already exists");
      }
    }

    return this.organizationsRepository.updateOrganization(id, input);
  }

  async deleteOrganization(id: string) {
    const org = await this.organizationsRepository.getOrganizationById(id);
    if (!org) {
      throw new NotFoundException("Organization not found");
    }
    return this.organizationsRepository.deleteOrganization(id);
  }

  async addMemberToOrganization(
    organizationId: string,
    userId: string,
    role: string = "member",
    authorization?: string,
  ) {
    const result = await authApi.addMember({
      headers: authorization ? { authorization } : undefined,
      body: {
        userId,
        role: [role],
        organizationId,
      },
    });
    return result;
  }

  async removeMemberFromOrganization(
    organizationId: string,
    userId: string,
    authorization?: string,
  ) {
    const member = await this.organizationsRepository.getMemberByUserId(
      organizationId,
      userId,
    );
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    const result = await authApi.removeMember({
      headers: authorization ? { authorization } : undefined,
      body: {
        memberIdOrEmail: member.id,
        organizationId,
      },
    });
    return result;
  }

  async getMembersOfOrganization(
    organizationId: string,
    authorization?: string,
  ) {
    const result = await authApi.listMembers({
      headers: authorization ? { authorization } : undefined,
      query: { organizationId },
    });
    return result?.members ?? [];
  }

  async createInvitation(
    organizationId: string,
    email: string,
    role: string,
    authorization?: string,
  ) {
    const result = await authApi.createInvitation({
      headers: authorization ? { authorization } : undefined,
      body: {
        email: email.trim().toLowerCase(),
        role,
        organizationId,
      },
    });
    return result;
  }

  async listInvitations(
    organizationId: string,
    authorization?: string,
  ) {
    const result = await authApi.listInvitations({
      headers: authorization ? { authorization } : undefined,
      query: { organizationId },
    });
    const rows = Array.isArray(result) ? result : [];
    const pending = rows.filter(
      (invitation: { status?: string }) =>
        (invitation.status ?? "pending") === "pending",
    );
    const publicIds =
      await this.organizationsRepository.getInvitationPublicIdsByIds(
        pending.map((invitation: { id: string }) => invitation.id),
      );
    return pending.flatMap((invitation: { id: string }) => {
      const publicId = publicIds.get(invitation.id);
      if (!publicId) return [];
      return [{ ...invitation, id: publicId }];
    });
  }

  async cancelInvitation(
    organizationId: string,
    publicId: string,
    authorization?: string,
  ) {
    const invitation =
      await this.organizationsRepository.getInvitationByPublicId(publicId);
    if (!invitation || invitation.organizationId !== organizationId) {
      throw new NotFoundException("Invitation not found");
    }
    const result = await authApi.cancelInvitation({
      headers: authorization ? { authorization } : undefined,
      body: { invitationId: invitation.id },
    });
    return result;
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    role: string,
    authorization?: string,
  ) {
    const result = await authApi.updateMemberRole({
      headers: authorization ? { authorization } : undefined,
      body: { memberId, role, organizationId },
    });
    return result;
  }

  async updateMemberProfile(
    organizationId: string,
    userId: string,
    name: string,
  ) {
    const member = await this.organizationsRepository.getMemberByUserId(
      organizationId,
      userId,
    );
    if (!member) {
      throw new NotFoundException("Member not found");
    }
    return this.organizationsRepository.updateMember(organizationId, member.id, {
      name,
    });
  }

  async transferOrganization(
    organizationId: string,
    actorUserId: string,
    targetMemberId: string,
    authorization?: string,
  ) {
    const target = await this.organizationsRepository.getMemberById(
      organizationId,
      targetMemberId,
    );
    if (!target) {
      throw new NotFoundException("Member not found");
    }
    if (target.userId === actorUserId) {
      throw new ConflictException(
        "You already own this organization",
      );
    }

    const headers = authorization ? { authorization } : undefined;

    await authApi.updateMemberRole({
      headers,
      body: { memberId: target.id, role: "owner", organizationId },
    });

    const actor = await this.organizationsRepository.getMemberByUserId(
      organizationId,
      actorUserId,
    );
    if (actor) {
      await authApi.updateMemberRole({
        headers,
        body: { memberId: actor.id, role: "admin", organizationId },
      });
    }

    return { success: true };
  }
}
