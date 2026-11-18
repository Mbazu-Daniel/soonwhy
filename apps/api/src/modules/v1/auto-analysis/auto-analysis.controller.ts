import { Body, Controller, Get, Inject, Put, UseGuards } from "@nestjs/common";
import { CurrentOrg, OrgContext } from "../../../common/decorators/current-org.decorator";
import { OwnerOrAdminGuard } from "../../../common/guards/owner-or-admin.guard";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { AutoAnalysisSettingsSchema, type AutoAnalysisSettingsInput } from "./auto-analysis.schema";
import { RcaService } from "../detections/rca.service";
import { getSettings, saveSettings } from "./auto-analysis.store";

@UseGuards(TenantGuard)
@Controller("ai/auto-analysis")
export class AutoAnalysisController {
  constructor(@Inject(RcaService) private readonly credentials: Pick<RcaService, "describe">) {}

  private async view(orgId: string, settings: Awaited<ReturnType<typeof getSettings>>) {
    const source = (await this.credentials.describe(orgId)).source;
    return { ...settings, capApplies: source !== "byok" };
  }

  @Get()
  async get(@CurrentOrg() org: OrgContext) {
    return this.view(org.orgId, await getSettings(org.orgId));
  }

  @Put()
  @UseGuards(OwnerOrAdminGuard)
  async save(
    @CurrentOrg() org: OrgContext,
    @Body({ schema: AutoAnalysisSettingsSchema }) body: AutoAnalysisSettingsInput,
  ) {
    return this.view(org.orgId, await saveSettings(org.orgId, body));
  }
}
