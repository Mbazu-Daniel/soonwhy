import { Controller, Post, Get, Delete, Body, Param, UseGuards } from "@nestjs/common";
import {
  CurrentOrg,
  type OrgContext,
} from "../../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../../common/middleware/tenant-context.guard";
import { AIInvestigationService } from "./ai-investigation.service";
import type {
  InvestigationRequest,
  InvestigationResult,
  InvestigationProgress,
} from "./ai-investigation.types";

@UseGuards(TenantGuard)
@Controller("intelligence/investigation")
export class AIInvestigationController {
  constructor(private readonly investigationService: AIInvestigationService) {}

  @Post("start")
  async startInvestigation(
    @CurrentOrg() org: OrgContext,
    @Body() request: InvestigationRequest,
  ): Promise<{ investigationId: string }> {
    const investigationId = await this.investigationService.startInvestigation(request, org.orgId);
    return { investigationId };
  }

  @Get("progress/:investigationId")
  async getProgress(
    @CurrentOrg() org: OrgContext,
    @Param("investigationId") investigationId: string,
  ): Promise<InvestigationProgress | undefined> {
    return this.investigationService.getInvestigationProgress(investigationId, org.orgId);
  }

  @Get("result/:investigationId")
  async getResult(
    @CurrentOrg() org: OrgContext,
    @Param("investigationId") investigationId: string,
  ): Promise<InvestigationResult | undefined> {
    return this.investigationService.getInvestigationResult(investigationId, org.orgId);
  }

  @Delete(":investigationId")
  clearInvestigation(
    @CurrentOrg() org: OrgContext,
    @Param("investigationId") investigationId: string,
  ): { success: boolean } {
    const success = this.investigationService.clearInvestigation(investigationId);
    return { success };
  }
}
