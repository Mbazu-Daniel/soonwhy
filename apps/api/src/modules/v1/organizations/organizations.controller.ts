import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../common/db";
import { auditLogs } from "../../../common/db/schema";
import { recordAuditEvent } from "../../../common/audit-logs";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto, UpdateOrganizationDto } from "./dto";
import {
  CurrentUser,
  AuthUser,
} from "../../../common/decorators/current-user.decorator";
import {
  CurrentMember,
  MemberContext,
} from "../../../common/decorators/current-member.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";

const auditLogListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async createOrganization(
    @CurrentUser() user: AuthUser | null,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    if (!user) throw new UnauthorizedException("Sign in required");
    const input = CreateOrganizationDto.parse(body);
    const result = await this.organizationsService.createOrganization(
      user.id,
      input,
      authorization,
    );

    await recordAuditEvent({
      userId: user.id,
      organizationId: result?.organization?.id,
      action: "organization.create",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { name: input.name, slug: input.slug },
    });

    return result;
  }

  @Get()
  async getOrganizationsForUser(
    @CurrentUser() user: AuthUser | null,
    @Headers("authorization") authorization: string | undefined,
  ) {
    if (!user) throw new UnauthorizedException("Sign in required");
    return this.organizationsService.getOrganizationsForUser(authorization);
  }
}

@UseGuards(TenantGuard)
@Controller("organization/:organizationId")
export class OrganizationController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  async getOrganizationById(
    @Param("organizationId") organizationId: string,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, organizationId);
    return this.organizationsService.getOrganizationById(organizationId);
  }

  @Put()
  async updateOrganization(
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
    @CurrentMember() member: MemberContext,
    @Req() req: Request,
  ) {
    this.assertOrganization(member, organizationId);
    if (!["owner", "admin"].includes(member.role)) {
      throw new ForbiddenException("Insufficient permissions");
    }
    const input = UpdateOrganizationDto.parse(body);
    const result = await this.organizationsService.updateOrganization(
      organizationId,
      input,
    );

    await recordAuditEvent({
      userId: member.userId,
      organizationId,
      action: "organization.update",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: input,
    });

    return result;
  }

  @Delete()
  async deleteOrganization(
    @Param("organizationId") organizationId: string,
    @CurrentMember() member: MemberContext,
    @Req() req: Request,
  ) {
    this.assertOrganization(member, organizationId);
    if (member.role !== "owner") {
      throw new ForbiddenException("Only owners can delete organizations");
    }
    const result =
      await this.organizationsService.deleteOrganization(organizationId);

    await recordAuditEvent({
      userId: member.userId,
      organizationId,
      action: "organization.delete",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return result;
  }

  @Get("members")
  async getMembersOfOrganization(
    @Param("organizationId") organizationId: string,
    @CurrentMember() member: MemberContext,
  ) {
    this.assertOrganization(member, organizationId);
    return this.organizationsService.getMembersOfOrganization(organizationId);
  }

  @Post("members")
  async addMemberToOrganization(
    @Param("organizationId") organizationId: string,
    @Body() body: { userId: string; role?: string },
    @CurrentMember() member: MemberContext,
    @Req() req: Request,
  ) {
    this.assertOrganization(member, organizationId);
    if (!["owner", "admin"].includes(member.role)) {
      throw new ForbiddenException("Only owners and admins can add members");
    }
    const result = await this.organizationsService.addMemberToOrganization(
      organizationId,
      body.userId,
      body.role,
    );

    await recordAuditEvent({
      userId: member.userId,
      organizationId,
      action: "member.create",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { targetUserId: body.userId, role: body.role },
    });

    return result;
  }

  @Delete("members/:userId")
  async removeMemberFromOrganization(
    @Param("organizationId") organizationId: string,
    @Param("userId") userId: string,
    @CurrentMember() member: MemberContext,
    @Req() req: Request,
  ) {
    this.assertOrganization(member, organizationId);
    if (!["owner", "admin"].includes(member.role)) {
      throw new ForbiddenException("Only owners and admins can remove members");
    }
    const result = await this.organizationsService.removeMemberFromOrganization(
      organizationId,
      userId,
    );

    await recordAuditEvent({
      userId: member.userId,
      organizationId,
      action: "member.delete",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { targetUserId: userId },
    });

    return result;
  }

  @Get("audit-logs")
  async getAuditLogs(
    @Param("organizationId") organizationId: string,
    @CurrentMember() member: MemberContext,
    @Query() query: unknown,
  ) {
    this.assertOrganization(member, organizationId);
    const { limit, offset } = auditLogListSchema.parse(query);
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, organizationId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  private assertOrganization(
    member: MemberContext,
    organizationId: string,
  ): void {
    if (member.orgId !== organizationId) {
      throw new ForbiddenException(
        "Organization context does not match the resource",
      );
    }
  }
}
