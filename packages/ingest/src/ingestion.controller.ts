import {
  Controller, Post, Body, Headers, HttpCode, HttpStatus,
  UnauthorizedException, BadRequestException, Logger,
} from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { ApiKeysService } from './api-keys.service';
import { z } from 'zod';

const IngestEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number().int().positive(),
  type: z.enum(['log', 'metric', 'error', 'request', 'trace']),
  projectId: z.string().min(1),
  service: z.string().optional(),
  data: z.record(z.unknown()),
});

const IngestBatchSchema = z.object({
  batch: z.array(IngestEventSchema).min(1).max(1000),
});

interface IngestResponse {
  accepted: number;
  rejected: number;
  errors?: string[];
}

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

    const parsed = IngestBatchSchema.safeParse(body);
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
