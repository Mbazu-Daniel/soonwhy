import { Body, Controller, Get, Inject, Put, UseGuards } from "@nestjs/common";
import { CurrentOrg, OrgContext } from "../../../../../common/decorators/current-org.decorator";
import { OwnerOrAdminGuard } from "../../../../../common/guards/owner-or-admin.guard";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";
import { AutoAnalysisSettingsSchema, type AutoAnalysisSettingsInput } from "../domain/auto-analysis.schema";
import { RcaApiService } from "../../../detection/detections/application/rca.api";
import { AutoAnalysisService } from "../application/auto-analysis.service";

@UseGuards(TenantGuard)
@Controller("ai/auto-analysis")
export class AutoAnalysisController {
  constructor(
    @Inject(RcaApiService) private readonly credentials: Pick<RcaApiService, "describe">,
    private readonly autoAnalysis: AutoAnalysisService,
  ) {}

  private async view(orgId: string, settings: Awaited<ReturnType<AutoAnalysisService["settings"]>>) {
    const source = (await this.credentials.describe(orgId)).source;
    return { ...settings, capApplies: source !== "byok" };
  }

  @Get()
  async get(@CurrentOrg() org: OrgContext) {
    return this.view(org.orgId, await this.autoAnalysis.settings(org.orgId));
  }

  @Put()
  @UseGuards(OwnerOrAdminGuard)
  async save(
    @CurrentOrg() org: OrgContext,
    @Body({ schema: AutoAnalysisSettingsSchema }) body: AutoAnalysisSettingsInput,
  ) {
    return this.view(org.orgId, await this.autoAnalysis.updateSettings(org.orgId, body));
  }
}
