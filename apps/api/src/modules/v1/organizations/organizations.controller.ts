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
}

@UseGuards(TenantGuard)
@Controller('organization/:organizationId')
export class OrganizationController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  async getOrganizationById(
    @Param('organizationId') organizationId: string,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, organizationId);
    return this.organizationsService.getOrganizationById(organizationId);
  }

  @Put()
  async updateOrganization(
    @Param('organizationId') organizationId: string,
    @Body() body: unknown,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, organizationId);
    if (!['owner', 'admin'].includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const input = UpdateOrganizationDto.parse(body);
    return this.organizationsService.updateOrganization(organizationId, input);
  }

  @Delete()
  async deleteOrganization(
    @Param('organizationId') organizationId: string,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, organizationId);
    if (member.role !== 'owner') {
      throw new ForbiddenException('Only owners can delete organizations');
    }
    return this.organizationsService.deleteOrganization(organizationId);
  }

  @Get('members')
  async getMembersOfOrganization(
    @Param('organizationId') organizationId: string,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, organizationId);
    return this.organizationsService.getMembersOfOrganization(organizationId);
  }

  @Post('members')
  async addMemberToOrganization(
    @Param('organizationId') organizationId: string,
    @Body() body: { userId: string; role?: string },
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, organizationId);
    if (!['owner', 'admin'].includes(member.role)) {
      throw new ForbiddenException('Only owners and admins can add members');
    }
    return this.organizationsService.addMemberToOrganization(organizationId, body.userId, body.role);
  }

  @Delete('members/:userId')
  async removeMemberFromOrganization(
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, organizationId);
    if (!['owner', 'admin'].includes(member.role)) {
      throw new ForbiddenException('Only owners and admins can remove members');
    }
    return this.organizationsService.removeMemberFromOrganization(organizationId, userId);
  }

  private assertOrganization(member: MemberContext, organizationId: string): void {
    if (member.orgId !== organizationId) {
      throw new ForbiddenException('Organization context does not match the resource');
    }
  }
}
