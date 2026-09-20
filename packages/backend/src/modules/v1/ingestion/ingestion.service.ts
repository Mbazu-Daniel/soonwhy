import { Injectable, Logger } from '@nestjs/common';
import { NatsService } from '../../../nats';
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
    orgId: string,
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

        const subject = `ingest.${orgId}.${event.type}`;
        const data = new TextEncoder().encode(JSON.stringify(event));
        await this.nats.publish(subject, data);
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
