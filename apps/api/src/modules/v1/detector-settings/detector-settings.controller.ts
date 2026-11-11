import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  type OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { DetectorSettingsService } from "./detector-settings.service";

@UseGuards(TenantGuard)
@Controller("settings/detectors")
export class DetectorSettingsController {
  constructor(private readonly detectorSettings: DetectorSettingsService) {}

  @Get()
  get(@CurrentOrg() org: OrgContext) {
    return this.detectorSettings.get(org.orgId);
  }

  @Patch()
  merge(@CurrentOrg() org: OrgContext, @Body() body: unknown) {
    return this.detectorSettings.update(org.orgId, body, "merge");
  }

  @Put()
  replace(@CurrentOrg() org: OrgContext, @Body() body: unknown) {
    return this.detectorSettings.update(org.orgId, body, "replace");
  }

  @Delete()
  @HttpCode(200)
  reset(@CurrentOrg() org: OrgContext) {
    return this.detectorSettings.reset(org.orgId);
  }
}
