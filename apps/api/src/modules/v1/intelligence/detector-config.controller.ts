import { Controller, Get, Post, Put, Delete, Body, Param } from "@nestjs/common";
import { DetectorConfigService } from "./detector-config.service";

@Controller("intelligence/detector-config")
export class DetectorConfigController {
  constructor(private readonly configService: DetectorConfigService) {}

  @Get(":organizationId/:detectorName/:thresholdName")
  async getThreshold(
    @Param("organizationId") organizationId: string,
    @Param("detectorName") detectorName: string,
    @Param("thresholdName") thresholdName: string,
    @Body("defaultValue") defaultValue?: number,
  ): Promise<{ value: number }> {
    const value = await this.configService.getDetectorThreshold(
      organizationId,
      detectorName,
      thresholdName,
      defaultValue ?? 0,
    );
    return { value };
  }

  @Get(":organizationId/:detectorName")
  async getDetectorConfigs(
    @Param("organizationId") organizationId: string,
    @Param("detectorName") detectorName: string,
  ): Promise<Record<string, number>> {
    return this.configService.getDetectorConfigs(organizationId, detectorName);
  }

  @Get(":organizationId")
  async getAllDetectorConfigs(
    @Param("organizationId") organizationId: string,
  ): Promise<Record<string, Record<string, number>>> {
    return this.configService.getAllDetectorConfigs(organizationId);
  }

  @Put(":organizationId/:detectorName/:thresholdName")
  async setThreshold(
    @Param("organizationId") organizationId: string,
    @Param("detectorName") detectorName: string,
    @Param("thresholdName") thresholdName: string,
    @Body("value") value: number,
  ): Promise<{ success: boolean }> {
    await this.configService.setDetectorThreshold(organizationId, detectorName, thresholdName, value);
    return { success: true };
  }

  @Delete(":organizationId/:detectorName/:thresholdName")
  async deleteThreshold(
    @Param("organizationId") organizationId: string,
    @Param("detectorName") detectorName: string,
    @Param("thresholdName") thresholdName: string,
  ): Promise<{ success: boolean }> {
    await this.configService.deleteDetectorThreshold(organizationId, detectorName, thresholdName);
    return { success: true };
  }

  @Post(":organizationId/cache/clear")
  async clearCache(@Param("organizationId") organizationId: string): Promise<{ success: boolean }> {
    this.configService.clearCache(organizationId);
    return { success: true };
  }
}
