import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  async createApiKey(
    @Query('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    const input = CreateApiKeyDto.parse(body);
    return this.apiKeysService.createApiKey(projectId, input);
  }

  @Get()
  async getApiKeysForProject(@Query('projectId') projectId: string) {
    return this.apiKeysService.getApiKeysForProject(projectId);
  }

  @Delete(':id')
  async deleteApiKey(@Param('id') id: string) {
    return this.apiKeysService.deleteApiKey(id);
  }
}
