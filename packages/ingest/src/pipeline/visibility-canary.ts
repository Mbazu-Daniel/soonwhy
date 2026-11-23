import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type { QuickwitService } from "@soonwhy/shared";

export type CanaryStore = {
  zadd(key: string, score: number, member: string): Promise<unknown>;
  zremrangebyrank(key: string, start: number, stop: number): Promise<unknown>;
  zrangebyscore(key: string, min: string | number, max: string | number, withScores: "WITHSCORES"): Promise<string[]>;
  zremrangebyscore(key: string, min: string | number, max: string | number): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  quit(): Promise<unknown>;
};

const CANARIES_PER_INDEX = 5;
const KEY_TTL_SECONDS = 24 * 60 * 60;
const KEY_PREFIX = "ingest:canary:";

@Injectable()
export class VisibilityCanary implements OnModuleDestroy {
  private readonly logger = new Logger(VisibilityCanary.name);

  constructor(
    private readonly store: CanaryStore,
    private readonly now: () => number = Date.now,
  ) {}

  async record(indexId: string, eventId: string, at = this.now()): Promise<void> {
    const key = KEY_PREFIX + indexId;
    try {
      await this.store.zadd(key, at, eventId);
      await this.store.zremrangebyrank(key, 0, -(CANARIES_PER_INDEX + 1));
      await this.store.expire(key, KEY_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(
        `Could not record a visibility canary for "${indexId}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async indexerIsBehind(
    quickwit: Pick<QuickwitService, "findEventIds">,
    indexId: string,
    leaseMs: number,
    at = this.now(),
  ): Promise<boolean> {
    const key = KEY_PREFIX + indexId;
    const due = await this.store.zrangebyscore(key, "-inf", at - leaseMs, "WITHSCORES");
    const newestScore = due.at(-1);
    const newestId = due.at(-2);
    if (newestScore === undefined || newestId === undefined) return false;

    const found = await quickwit.findEventIds(indexId, [newestId]);
    if (!found.has(newestId)) return true;
    await this.store.zremrangebyscore(key, "-inf", newestScore);
    return false;
  }

  async onModuleDestroy(): Promise<void> {
    await this.store.quit().catch(() => undefined);
  }
}
