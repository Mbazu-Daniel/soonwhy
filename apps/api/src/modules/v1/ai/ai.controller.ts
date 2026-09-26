import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';
import { AiService } from './ai.service';

const AiCredentialSchema = z.object({ provider: z.string().min(1).max(50), model: z.string().min(1).max(100), apiKey: z.string().min(1).max(5000), baseUrl: z.string().url().optional().nullable() }).strict();

@Controller('ai')
@UseGuards(TenantGuard)
export class AiController {
  constructor(private readonly service: AiService) {}
  @Get('config') get(@CurrentOrg() org: OrgContext) { return this.service.get(org.orgId); }
  @Put('config') save(@CurrentOrg() org: OrgContext, @Body() body: unknown) { return this.service.save(org.orgId, AiCredentialSchema.parse(body)); }
  @Delete('config') remove(@CurrentOrg() org: OrgContext) { return this.service.remove(org.orgId); }
}
