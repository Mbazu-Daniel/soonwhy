import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { SyntheticProbesService } from "./synthetic-probes.service";
import {
  CreateSyntheticProbeDto,
  UpdateSyntheticProbeDto,
  type CreateSyntheticProbeInput,
  type UpdateSyntheticProbeInput,
} from "./dto";

@UseGuards(TenantGuard)
@Controller("projects/:projectId/synthetic-probes")
export class SyntheticProbesController {
  constructor(private readonly service: SyntheticProbesService) {}

  @Get()
  listProbes(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.getProbes(org.orgId, projectId);
  }

  @Post()
  createProbe(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body({ schema: CreateSyntheticProbeDto }) body: CreateSyntheticProbeInput,
  ) {
    return this.service.createProbe(org.orgId, projectId, body);
  }

  @Get(":probeId")
  getProbe(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("probeId", ParseIntPipe) probeId: number,
  ) {
    return this.service.getProbeById({ orgId: org.orgId, projectId }, probeId);
  }

  @Put(":probeId")
  updateProbe(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("probeId", ParseIntPipe) probeId: number,
    @Body({ schema: UpdateSyntheticProbeDto }) body: UpdateSyntheticProbeInput,
  ) {
    return this.service.updateProbe({ orgId: org.orgId, projectId }, probeId, body);
  }

  @Delete(":probeId")
  deleteProbe(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("probeId", ParseIntPipe) probeId: number,
  ) {
    return this.service.deleteProbe({ orgId: org.orgId, projectId }, probeId);
  }

  @Get(":probeId/results")
  getProbeResults(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("probeId", ParseIntPipe) probeId: number,
    @Query("limit") limit?: string,
  ) {
    return this.service.getProbeResults(
      { orgId: org.orgId, projectId },
      probeId,
      limit ? Number(limit) : 100,
    );
  }

  @Post(":probeId/execute")
  executeProbe(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("probeId", ParseIntPipe) probeId: number,
  ) {
    return this.service.executeProbeById({ orgId: org.orgId, projectId }, probeId);
  }
}
