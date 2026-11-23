import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DlqRepository } from "../infrastructure/dlq.repository";
import { NatsService } from "@soonwhy/shared";
import { mapWithConcurrency } from "../domain/dlq.concurrency";
import { BULK_REPLAY_CONCURRENCY, DLQ_REPLAY_STATUS, MAX_REPLAY_ATTEMPTS, REPLAY_MESSAGE_ID_PREFIX } from "../domain/dlq.constants";
import { parseEntryIds, parseRetentionDays } from "../domain/dlq.validation";

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(
    private readonly repository: DlqRepository,
    private readonly nats: NatsService,
  ) {}

  async getDlqEntries(limit: number = 100, offset: number = 0) {
    return this.repository.getDlqEntries(limit, offset);
  }

  async getDlqStats() {
    return this.repository.getDlqStats();
  }

  async getReplayAttempts(id: number) {
    return this.repository.getAttempts(id);
  }

  async getDlqEntryById(id: number) {
    return this.repository.getDlqEntryById(id);
  }

  async replayDlqEntry(id: number, actor: string, force = false) {
    const entry = await this.repository.getDlqEntryById(id);
    if (!entry) {
      throw new Error("DLQ entry not found");
    }

    if (entry.replayStatus === DLQ_REPLAY_STATUS.succeeded) {
      throw new Error("Entry already successfully replayed");
    }

    if (entry.payload && typeof entry.payload === "object" && "malformed" in entry.payload) {
      throw new Error("Cannot replay malformed payload");
    }

    if (!entry.organizationId || !entry.projectId) {
      throw new Error("Missing organization or project ID for replay");
    }

    const claimed = await this.repository.claimReplay(id, actor, force);
    if (!claimed) {
      if ((entry.replayAttempts ?? 0) >= MAX_REPLAY_ATTEMPTS && entry.replayStatus === DLQ_REPLAY_STATUS.failed) {
        throw new ConflictException(
          `Replay attempt limit (${MAX_REPLAY_ATTEMPTS}) reached; replay again with force to override`,
        );
      }
      throw new ConflictException("Entry already successfully replayed or replay in progress");
    }
    const attempt = claimed.replayAttempts ?? 1;

    try {
      const subject = `ingest.${entry.projectId}.${entry.signal}`;
      const payload = JSON.stringify(entry.payload);

      const acknowledged = await this.nats.publishWithAck(
        subject,
        new TextEncoder().encode(payload),
        `${REPLAY_MESSAGE_ID_PREFIX}:${id}`,
      );
      if (!acknowledged) {
        throw new Error("NATS JetStream did not acknowledge the replayed message");
      }

      const finalized = await this.repository.finalizeReplay(id, attempt, true);
      if (!finalized) {
        this.logger.warn(`DLQ entry ${id} was replayed but its claim was taken over before the result was recorded`);
      }
      this.logger.log(`Successfully replayed DLQ entry ${id} to ${subject}`);

      return { success: true, subject };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.repository.finalizeReplay(id, attempt, false, errorMessage);
      this.logger.error(`Failed to replay DLQ entry ${id}: ${errorMessage}`);
      throw error;
    }
  }

  async bulkReplay(rawIds: unknown, actor: string) {
    const ids = parseEntryIds(rawIds);
    const results = await mapWithConcurrency(ids, BULK_REPLAY_CONCURRENCY, async (id) => {
      try {
        await this.replayDlqEntry(id, actor);
        return { id, status: DLQ_REPLAY_STATUS.succeeded };
      } catch (error) {
        return { id, status: DLQ_REPLAY_STATUS.failed, error: error instanceof Error ? error.message : String(error) };
      }
    });
    const successful = results.filter((result) => result.status === DLQ_REPLAY_STATUS.succeeded).length;

    return { total: ids.length, successful, failed: ids.length - successful, results };
  }

  async deleteDlqEntry(id: number) {
    const { deleted } = await this.repository.deleteUnlessReplaying([id]);
    if (deleted.length > 0) return;
    const entry = await this.repository.getDlqEntryById(id);
    if (!entry) throw new NotFoundException("DLQ entry not found");
    throw new ConflictException("Entry is being replayed and cannot be deleted");
  }

  async bulkDelete(rawIds: unknown) {
    const ids = parseEntryIds(rawIds);
    const { deleted, refused } = await this.repository.deleteUnlessReplaying(ids);
    return { deleted: deleted.length, refused };
  }

  async exportDlqEntry(id: number) {
    const entry = await this.repository.getDlqEntryById(id);
    if (!entry) {
      throw new Error("DLQ entry not found");
    }
    return entry;
  }

  async cleanupOldEntries(rawDays: unknown) {
    const deleted = await this.repository.deleteSucceededEntries(parseRetentionDays(rawDays));
    return { deleted };
  }
}
