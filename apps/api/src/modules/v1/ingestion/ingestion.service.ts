import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../../../common/nats';
import { validateEvent, type TelemetryEvent } from '@soonwhy/shared';

export interface PublishResult {
  accepted: number;
  rejected: number;
  errors: string[];
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  constructor(private readonly nats: NatsService) {}

  async processBatch(
    events: TelemetryEvent[],
    projectId: string,
  ): Promise<PublishResult> {
    let accepted = 0;
    let rejected = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        event.projectId = projectId;
        const validation = validateEvent(event);
        if (!validation.success) {
          rejected++;
          errors.push(`Event ${event.id}: ${validation.error}`);
          continue;
        }
        const subject = `ingest.${projectId}.${event.type}`;
        await this.nats.publish(subject, new TextEncoder().encode(JSON.stringify(event)));
        accepted++;
      } catch (error) {
        rejected++;
        errors.push(`Event ${event.id}: publish failed`);
        this.logger.error(`Failed to publish event ${event.id}`, error);
      }
    }
    return { accepted, rejected, errors };
  }
}
