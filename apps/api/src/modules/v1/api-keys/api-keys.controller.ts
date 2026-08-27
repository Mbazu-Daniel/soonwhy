import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  async createApiKey(
    @CurrentOrg() org: OrgContext,
    @Body() body: unknown,
  ) {
    const input = CreateApiKeyDto.parse(body);
    return this.apiKeysService.createApiKey(org.orgId, input);
  }

  @Get()
  async getApiKeysForOrganization(@CurrentOrg() org: OrgContext) {
    return this.apiKeysService.getApiKeysForOrganization(org.orgId);
  }

  @Delete(':id')
  async deleteApiKey(@Param('id') id: string) {
    return this.apiKeysService.deleteApiKey(id);
  }
}
