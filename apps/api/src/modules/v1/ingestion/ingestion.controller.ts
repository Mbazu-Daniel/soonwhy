import {
  Controller, Post, Body, Headers, HttpCode, HttpStatus,
  UnauthorizedException, BadRequestException, Logger,
} from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { IngestBodySchema, type IngestResponse } from './dto';

@Controller('ingestion')
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly apiKeysService: ApiKeysService,
  ) {}

  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  async ingest(
    @Body() body: unknown,
    @Headers('authorization') authorization: string,
  ): Promise<IngestResponse> {
    const apiKey = this.extractApiKey(authorization);
    if (!apiKey) throw new UnauthorizedException('Missing or invalid API key');

    const parsed = IngestBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(`Invalid batch: ${parsed.error.errors.map((e) => e.message).join(', ')}`);
    }

    const keyResult = await this.apiKeysService.validateKey(apiKey);
    if (!keyResult) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    return this.ingestionService.processBatch(parsed.data.batch, keyResult.projectId);
  }

  private extractApiKey(authorization: string | undefined): string | null {
    if (!authorization) return null;
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1] ?? null;
  }
}
