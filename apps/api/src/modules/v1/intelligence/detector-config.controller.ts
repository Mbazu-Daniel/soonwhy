import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  Post,
  Param,
} from "@nestjs/common";
import { CurrentOrg, OrgContext } from "../../../common/decorators/current-org.decorator";
import { DetectorConfigService } from "./detector-config.service";

@Controller("intelligence/detector-config")
export class DetectorConfigController {
  constructor(private readonly configService: DetectorConfigService) {}

  @Get(":detectorName/:thresholdName")
  async getThreshold(
    @CurrentOrg() org: OrgContext,
    @Param("detectorName") detectorName: string,
    @Param("thresholdName") thresholdName: string,
    @Body("defaultValue") defaultValue?: number,
  ): Promise<{ value: number }> {
    const value = await this.configService.getDetectorThreshold(
      org.orgId,
      detectorName,
      thresholdName,
      defaultValue ?? 0,
    );
    return { value };
  }

  @Get(":detectorName")
  async getDetectorConfigs(
    @CurrentOrg() org: OrgContext,
    @Param("detectorName") detectorName: string,
  ): Promise<Record<string, number>> {
    return this.configService.getDetectorConfigs(org.orgId, detectorName);
  }

  @Get()
  async getAllDetectorConfigs(
    @CurrentOrg() org: OrgContext,
  ): Promise<Record<string, Record<string, number>>> {
    return this.configService.getAllDetectorConfigs(org.orgId);
  }

  @Put(":detectorName/:thresholdName")
  async setThreshold(
    @CurrentOrg() org: OrgContext,
    @Param("detectorName") detectorName: string,
    @Param("thresholdName") thresholdName: string,
    @Body("value") value: number,
  ): Promise<{ success: boolean }> {
    await this.configService.setDetectorThreshold(org.orgId, detectorName, thresholdName, value);
    return { success: true };
  }

  @Delete(":detectorName/:thresholdName")
  async deleteThreshold(
    @CurrentOrg() org: OrgContext,
    @Param("detectorName") detectorName: string,
    @Param("thresholdName") thresholdName: string,
  ): Promise<{ success: boolean }> {
    await this.configService.deleteDetectorThreshold(org.orgId, detectorName, thresholdName);
    return { success: true };
  }

  @Post("cache/clear")
  async clearCache(@CurrentOrg() org: OrgContext): Promise<{ success: boolean }> {
    this.configService.clearCache(org.orgId);
    return { success: true };
  }
}
