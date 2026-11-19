import { Inject, Injectable, Logger } from "@nestjs/common";
import { Redis } from "ioredis";
import { CACHE_KEY_PREFIX } from "./cache.constants";
import type { CacheHealth } from "./cache.service.types";

export function jitteredTtl(ttlSeconds: number, random: () => number = Math.random): number {
  if (ttlSeconds <= 1) return ttlSeconds;
  const spread = Math.max(1, Math.round(ttlSeconds * 0.1));
  return Math.max(1, ttlSeconds - spread + Math.floor(random() * (2 * spread + 1)));
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(@Inject(Redis) private readonly redis: Redis) {}

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(this.key(key));
      return value === null ? null : (JSON.parse(value) as T);
    } catch (error) {
      this.logger.warn(`Cache read failed for ${key}: ${errorMessage(error)}`);
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;

    try {
      await this.redis.setex(this.key(key), ttlSeconds, JSON.stringify(value));
    } catch (error) {
      this.logger.warn(`Cache write failed for ${key}: ${errorMessage(error)}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(this.key(key));
    } catch (error) {
      this.logger.warn(`Cache delete failed for ${key}: ${errorMessage(error)}`);
    }
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    let cursor = "0";
    let deleted = 0;

    try {
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          "MATCH",
          `${this.key(prefix)}*`,
          "COUNT",
          100,
        );
        cursor = next;
        if (keys.length) {
          deleted += await this.redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch (error) {
      this.logger.warn(`Cache prefix delete failed for ${prefix}: ${errorMessage(error)}`);
    }

    return deleted;
  }

  async getOrSet<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) return cached;

    const running = this.inFlight.get(key) as Promise<T> | undefined;
    if (running) return running;

    const task = (async () => {
      const value = await load();
      await this.setJson(key, value, jitteredTtl(ttlSeconds));
      return value;
    })().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, task);
    return task;
  }

  async health(): Promise<CacheHealth> {
    const started = Date.now();

    try {
      await this.redis.ping();
      return { status: "ok", latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: "unavailable",
        latencyMs: Date.now() - started,
        error: errorMessage(error),
      };
    }
  }

  private key(key: string): string {
    return `${CACHE_KEY_PREFIX}:${key}`;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
