import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";

const LEASE_KEY_PREFIX = "soonwhy:cron-lease:";
const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

@Injectable()
export class CronLeaseService {
  private readonly logger = new Logger(CronLeaseService.name);

  constructor(@Optional() @Inject(Redis) private readonly redis?: Redis) {}

  async runExclusive(
    name: string,
    ttlMs: number,
    fn: () => Promise<void>,
  ): Promise<boolean> {
    if (!this.redis) {
      await fn();
      return true;
    }

    const token = randomUUID();
    const key = `${LEASE_KEY_PREFIX}${name}`;

    let acquired = false;
    try {
      const result = await this.redis.set(key, token, "PX", ttlMs, "NX");
      acquired = result === "OK";
    } catch (error) {
      this.logger.warn(
        `Cron lease "${name}" unavailable (${errorMessage(error)}); running without lease`,
      );
      await fn();
      return true;
    }

    if (!acquired) {
      this.logger.log(`Cron "${name}" skipped: another instance holds the lease`);
      return false;
    }

    try {
      await fn();
      return true;
    } finally {
      try {
        await this.redis.eval(RELEASE_SCRIPT, 1, key, token);
      } catch {
        this.logger.warn(`Cron lease "${name}" release failed; it will expire after ${ttlMs}ms`);
      }
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
