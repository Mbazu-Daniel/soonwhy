import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { IngestBodySchema, type IngestResponse } from './dto';

@Controller('v1')
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(private readonly ingestionService: IngestionService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  async ingest(
    @Body() body: unknown,
    @Headers('authorization') authorization: string,
  ): Promise<IngestResponse> {
    const apiKey = this.extractApiKey(authorization);
    if (!apiKey) {
      throw new UnauthorizedException('Missing or invalid API key');
    }

    const parsed = IngestBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        `Invalid batch: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
      );
    }

    const { orgId, projectId } = await this.validateApiKey(apiKey);

    const result = await this.ingestionService.processBatch(
      parsed.data.batch,
      orgId,
      projectId,
    );

    this.logger.debug(
      `Ingested: ${result.accepted} accepted, ${result.rejected} rejected`,
    );

    return {
      accepted: result.accepted,
      rejected: result.rejected,
      errors: result.errors.length > 0 ? result.errors : undefined,
    };
  }

  private extractApiKey(authorization: string | undefined): string | null {
    if (!authorization) return null;
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
  }

  private async validateApiKey(
    apiKey: string,
  ): Promise<{ orgId: string; projectId: string }> {
    // TODO: Validate API key against database
    // For now, return placeholder
    return { orgId: 'org_placeholder', projectId: 'project_placeholder' };
  }
}
