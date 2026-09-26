import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';

@UseGuards(TenantGuard)
@Controller('projects/:projectId/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  async createApiKey(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    const input = CreateApiKeyDto.parse(body);
    return this.apiKeysService.createApiKey(projectId, org.orgId, input);
  }

  @Get()
  async getApiKeysForProject(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
  ) {
    return this.apiKeysService.getApiKeysForProject(projectId, org.orgId);
  }

  @Delete(':id')
  async deleteApiKey(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.apiKeysService.deleteApiKey(id, projectId, org.orgId);
  }
}
