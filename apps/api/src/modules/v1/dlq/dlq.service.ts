import { Injectable, Logger } from "@nestjs/common";
import { DlqRepository } from "./dlq.repository";
import { NatsService } from "@soonwhy/shared";
import type { NatsMessageHandler } from "@soonwhy/shared";

type JsMsg = Parameters<NatsMessageHandler>[0];

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

  async getDlqEntryById(id: number) {
    return this.repository.getDlqEntryById(id);
  }

  async replayDlqEntry(id: number) {
    const entry = await this.repository.getDlqEntryById(id);
    if (!entry) {
      throw new Error("DLQ entry not found");
    }

    if (entry.replayed && entry.replaySuccess) {
      throw new Error("Entry already successfully replayed");
    }

    // Check if payload is malformed
    if (entry.payload && typeof entry.payload === "object" && "malformed" in entry.payload) {
      throw new Error("Cannot replay malformed payload");
    }

    if (!entry.organizationId || !entry.projectId) {
      throw new Error("Missing organization or project ID for replay");
    }

    // Atomically claim replay to prevent concurrent double-publish/replay races.
    const claimed = await this.repository.claimReplay(id);
    if (!claimed) {
      throw new Error("Entry already successfully replayed or replay in progress");
    }

    try {
      // Republish to the original ingest subject (matches consumer subscription)
      const subject = `ingest.${entry.projectId}.${entry.signal}`;
      const payload = JSON.stringify(entry.payload);

      await this.nats.publish(subject, new TextEncoder().encode(payload));

      await this.repository.finalizeReplay(id, true);
      this.logger.log(`Successfully replayed DLQ entry ${id} to ${subject}`);

      return { success: true, subject };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.repository.finalizeReplay(id, false, errorMessage);
      this.logger.error(`Failed to replay DLQ entry ${id}: ${errorMessage}`);
      throw error;
    }
  }

  async bulkReplay(ids: number[]) {
    const results = await Promise.allSettled(
      ids.map((id) => this.replayDlqEntry(id))
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return {
      total: ids.length,
      successful,
      failed,
    };
  }

  async deleteDlqEntry(id: number) {
    await this.repository.deleteDlqEntry(id);
  }

  async bulkDelete(ids: number[]) {
    await this.repository.bulkDelete(ids);
  }

  async exportDlqEntry(id: number) {
    const entry = await this.repository.getDlqEntryById(id);
    if (!entry) {
      throw new Error("DLQ entry not found");
    }
    return entry;
  }

  async cleanupOldEntries(daysOld: number = 7) {
    await this.repository.deleteReplayedEntries(daysOld);
  }
}
