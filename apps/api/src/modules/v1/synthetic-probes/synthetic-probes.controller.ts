import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { SyntheticProbesService } from "./synthetic-probes.service";
import { CreateSyntheticProbeDto, UpdateSyntheticProbeDto } from "./dto";

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
    @Body() body: unknown,
  ) {
    const input = CreateSyntheticProbeDto.parse(body);
    return this.service.createProbe(org.orgId, projectId, input);
  }

  @Get(":probeId")
  getProbe(
    @CurrentOrg() org: OrgContext,
    @Param("probeId") probeId: string,
  ) {
    return this.service.getProbeById(Number(probeId));
  }

  @Put(":probeId")
  updateProbe(
    @CurrentOrg() org: OrgContext,
    @Param("probeId") probeId: string,
    @Body() body: unknown,
  ) {
    const input = UpdateSyntheticProbeDto.parse(body);
    return this.service.updateProbe(Number(probeId), input);
  }

  @Delete(":probeId")
  deleteProbe(
    @CurrentOrg() org: OrgContext,
    @Param("probeId") probeId: string,
  ) {
    return this.service.deleteProbe(Number(probeId));
  }

  @Get(":probeId/results")
  getProbeResults(
    @CurrentOrg() org: OrgContext,
    @Param("probeId") probeId: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.getProbeResults(
      Number(probeId),
      limit ? Number(limit) : 100,
    );
  }

  @Post(":probeId/execute")
  executeProbe(
    @CurrentOrg() org: OrgContext,
    @Param("probeId") probeId: string,
  ) {
    return this.service.getProbeById(Number(probeId)).then((probe) =>
      this.service.executeProbe(probe),
    );
  }
}
