import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { OrganizationsRepository } from './organizations.repository';
import { CreateOrganizationInput, UpdateOrganizationInput } from './dto';
import { auth } from '../../../common/config/better-auth.config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authApi = auth.api as any;

@Injectable()
export class OrganizationsService {
  constructor(private readonly organizationsRepository: OrganizationsRepository) {}

  async getOrganizationById(id: string) {
    const org = await this.organizationsRepository.getOrganizationById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async getOrganizationBySlug(slug: string) {
    const org = await this.organizationsRepository.getOrganizationBySlug(slug);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async getOrganizationsForUser(authorization?: string) {
    return authApi.listOrganizations({
      headers: authorization ? { authorization } : {},
    });
  }

  async createOrganization(userId: string, input: CreateOrganizationInput, authorization?: string) {
    const existing = await this.organizationsRepository.getOrganizationBySlug(input.slug);
    if (existing) {
      throw new ConflictException('Organization slug already exists');
    }

    const result = await authApi.createOrganization({
      headers: authorization ? { authorization } : {},
      body: {
        name: input.name,
        slug: input.slug,
        userId,
      },
    });

    return result;
  }

  async updateOrganization(id: string, input: UpdateOrganizationInput) {
    const org = await this.organizationsRepository.getOrganizationById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (input.slug && input.slug !== org.slug) {
      const existing = await this.organizationsRepository.getOrganizationBySlug(input.slug);
      if (existing) {
        throw new ConflictException('Organization slug already exists');
      }
    }

    return this.organizationsRepository.updateOrganization(id, input);
  }

  async deleteOrganization(id: string) {
    const org = await this.organizationsRepository.getOrganizationById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return this.organizationsRepository.deleteOrganization(id);
  }

  async addMemberToOrganization(organizationId: string, userId: string, role: string = 'member') {
    const result = await authApi.addMember({
      body: {
        userId,
        role: [role],
        organizationId,
      },
    });
    return result;
  }

  async removeMemberFromOrganization(organizationId: string, userId: string) {
    const result = await authApi.removeMember({
      body: {
        memberIdOrEmail: userId,
        organizationId,
      },
    });
    return result;
  }

  async getMembersOfOrganization(organizationId: string) {
    const result = await authApi.listMembers({
      query: { organizationId },
    });
    return result;
  }
}
