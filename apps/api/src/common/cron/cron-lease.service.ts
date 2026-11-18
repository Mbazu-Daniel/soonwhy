import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { db } from "../db";

const LEASE_KEY_PREFIX = "soonwhy:cron-lease:";
const RENEWALS_PER_TTL = 3;
const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;
const RENEW_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
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
    if (!this.redis) return this.runWithAdvisoryLock(name, fn);

    const token = randomUUID();
    const key = `${LEASE_KEY_PREFIX}${name}`;

    let acquired = false;
    try {
      const result = await this.redis.set(key, token, "PX", ttlMs, "NX");
      acquired = result === "OK";
    } catch (error) {
      this.logger.warn(
        `Cron lease "${name}" unavailable in Redis (${errorMessage(error)}); using a database lock`,
      );
      return this.runWithAdvisoryLock(name, fn);
    }

    if (!acquired) {
      this.logger.log(`Cron "${name}" skipped: another instance holds the lease`);
      return false;
    }

    const renewal = this.keepAlive(key, token, ttlMs, name);
    try {
      await fn();
      return true;
    } finally {
      clearInterval(renewal);
      try {
        await this.redis.eval(RELEASE_SCRIPT, 1, key, token);
      } catch {
        this.logger.warn(`Cron lease "${name}" release failed; it will expire after ${ttlMs}ms`);
      }
    }
  }

  private keepAlive(key: string, token: string, ttlMs: number, name: string): NodeJS.Timeout {
    const timer = setInterval(() => {
      this.redis!
        .eval(RENEW_SCRIPT, 1, key, token, String(ttlMs))
        .then((renewed) => {
          if (renewed !== 1) this.logger.warn(`Cron lease "${name}" was lost while the job was still running`);
        })
        .catch((error: unknown) => {
          this.logger.warn(`Cron lease "${name}" renewal failed: ${errorMessage(error)}`);
        });
    }, Math.max(1_000, Math.floor(ttlMs / RENEWALS_PER_TTL)));
    timer.unref();
    return timer;
  }

  private async runWithAdvisoryLock(name: string, fn: () => Promise<void>): Promise<boolean> {
    let ran = false;
    let failed = false;
    let failure: unknown;
    try {
      await db.transaction(async (tx) => {
        const rows = (await tx.execute(
          sql`select pg_try_advisory_xact_lock(hashtext(${LEASE_KEY_PREFIX + name})) as locked`,
        )) as unknown as Array<{ locked: boolean }>;
        if (!rows[0]?.locked) return;
        ran = true;
        try {
          await fn();
        } catch (error) {
          failed = true;
          failure = error;
        }
      });
    } catch (error) {
      if (!failed) {
        this.logger.warn(`Cron "${name}" skipped: could not take the database lock (${errorMessage(error)})`);
        return false;
      }
    }
    if (failed) throw failure;
    if (!ran) this.logger.log(`Cron "${name}" skipped: another instance holds the lock`);
    return ran;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
