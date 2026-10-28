import { Injectable, Logger } from "@nestjs/common";
import { QuickwitService, QUICKWIT_INDEXES } from "@soonwhy/shared";
import { ClientEventInput } from "./dto";

interface ValidatedKey {
  projectId: string;
  scopes: string[];
}

@Injectable()
export class ClientEventsService {
  private readonly logger = new Logger(ClientEventsService.name);

  constructor(private readonly quickwit: QuickwitService) {}

  /**
   * Ingest a batch of client-side events into Quickwit telemetry-logs index.
   * Events are tagged with org_id and project_id derived from the API key.
   */
  async ingestEvents(
    orgId: string,
    projectId: string,
    events: ClientEventInput[],
  ): Promise<void> {
    const now = new Date().toISOString();

    const documents = events.map((event) => ({
      timestamp: event.timestamp ?? now,
      org_id: orgId,
      project_id: projectId,
      event_type: event.type,
      message: event.message ?? null,
      severity: event.severity ?? "medium",
      stack: event.stack ?? null,
      url: event.url ?? null,
      user_agent: event.userAgent ?? null,
      user_id: event.userId ?? null,
      session_id: event.sessionId ?? null,
      trace_id: event.traceId ?? null,
      span_id: event.spanId ?? null,
      attributes: event.attributes ?? {},
      source: "client",
    }));

    try {
      await this.quickwit.ingest(QUICKWIT_INDEXES.logs, documents);
    } catch (error) {
      this.logger.error(
        `Failed to ingest ${documents.length} client events`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }
}
