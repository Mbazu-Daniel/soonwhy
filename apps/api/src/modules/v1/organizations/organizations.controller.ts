import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto';
import { CurrentUser, AuthUser } from '../../../common/decorators/current-user.decorator';
import { CurrentMember, MemberContext } from '../../../common/decorators/current-member.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async createOrganization(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = CreateOrganizationDto.parse(body);
    return this.organizationsService.createOrganization(user.id, input);
  }

  @Get()
  async getOrganizationsForUser(@CurrentUser() user: AuthUser) {
    return this.organizationsService.getOrganizationsForUser(user.id);
  }

  @UseGuards(TenantGuard)
  @Get(':id')
  async getOrganizationById(
    @Param('id') id: string,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, id);
    return this.organizationsService.getOrganizationById(id);
  }

  @UseGuards(TenantGuard)
  @Put(':id')
  async updateOrganization(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, id);
    if (!['owner', 'admin'].includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const input = UpdateOrganizationDto.parse(body);
    return this.organizationsService.updateOrganization(id, input);
  }

  @UseGuards(TenantGuard)
  @Delete(':id')
  async deleteOrganization(
    @Param('id') id: string,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, id);
    if (member.role !== 'owner') {
      throw new ForbiddenException('Only owners can delete organizations');
    }
    return this.organizationsService.deleteOrganization(id);
  }

  @UseGuards(TenantGuard)
  @Get(':id/members')
  async getMembersOfOrganization(
    @Param('id') id: string,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, id);
    return this.organizationsService.getMembersOfOrganization(id);
  }

  @UseGuards(TenantGuard)
  @Post(':id/members')
  async addMemberToOrganization(
    @Param('id') id: string,
    @Body() body: { userId: string; role?: string },
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, id);
    if (!['owner', 'admin'].includes(member.role)) {
      throw new ForbiddenException('Only owners and admins can add members');
    }
    return this.organizationsService.addMemberToOrganization(id, body.userId, body.role);
  }

  @UseGuards(TenantGuard)
  @Delete(':id/members/:userId')
  async removeMemberFromOrganization(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, id);
    if (!['owner', 'admin'].includes(member.role)) {
      throw new ForbiddenException('Only owners and admins can remove members');
    }
    return this.organizationsService.removeMemberFromOrganization(id, userId);
  }

  private assertOrganization(member: MemberContext, organizationId: string): void {
    if (member.orgId !== organizationId) {
      throw new ForbiddenException('Organization context does not match the resource');
    }
  }
}
