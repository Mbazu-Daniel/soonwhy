import { Inject, Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import {
  IdempotencyStorage,
  type IdempotencyAcquireResult,
  type IdempotencyStore,
  type IdempotencyStoredPayload,
} from "@nestjs/idempotency";

const KEY_PREFIX = "soonwhy:idem:";

@Injectable()
export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(
    @Inject(Redis) private readonly redis: Redis,
    storage: IdempotencyStorage,
  ) {
    storage.registerSource(this);
  }

  private key(key: string): string {
    return `${KEY_PREFIX}${key}`;
  }

  async acquire(
    key: string,
    owner: string,
    fingerprint: string,
    lockTtl: number,
  ): Promise<IdempotencyAcquireResult> {
    const raw = (await this.redis.eval(
      `
      local fields = redis.call("HGETALL", KEYS[1])
      if #fields == 0 then
        redis.call("HSET", KEYS[1], "state", "in-flight", "fingerprint", ARGV[2], "owner", ARGV[1], "response", "")
        redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[3]))
        return {"acquired"}
      end
      local map = {}
      for i = 1, #fields, 2 do
        map[fields[i]] = fields[i + 1]
      end
      if map["state"] == "in-flight" then
        return {"in-flight", map["fingerprint"]}
      end
      return {"completed", map["fingerprint"], map["response"]}
      `,
      1,
      this.key(key),
      owner,
      fingerprint,
      String(lockTtl),
    )) as string[];

    if (raw[0] === "acquired") return { state: "acquired" };
    if (raw[0] === "in-flight") {
      return { state: "in-flight", fingerprint: raw[1] ?? "" };
    }
    return {
      state: "completed",
      fingerprint: raw[1] ?? "",
      response: JSON.parse(raw[2] ?? "{}") as IdempotencyStoredPayload,
    };
  }

  async complete(
    key: string,
    owner: string,
    response: IdempotencyStoredPayload,
    ttl: number,
  ): Promise<boolean> {
    const result = (await this.redis.eval(
      `
      local fields = redis.call("HGETALL", KEYS[1])
      if #fields == 0 then return 0 end
      local map = {}
      for i = 1, #fields, 2 do
        map[fields[i]] = fields[i + 1]
      end
      if map["state"] ~= "in-flight" or map["owner"] ~= ARGV[1] then return 0 end
      redis.call("HSET", KEYS[1], "state", "completed", "response", ARGV[2])
      redis.call("HDEL", KEYS[1], "owner")
      redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[3]))
      return 1
      `,
      1,
      this.key(key),
      owner,
      JSON.stringify(response),
      String(ttl),
    )) as number;
    return result === 1;
  }

  async release(key: string, owner: string): Promise<boolean> {
    const result = (await this.redis.eval(
      `
      local fields = redis.call("HGETALL", KEYS[1])
      if #fields == 0 then return 0 end
      local map = {}
      for i = 1, #fields, 2 do
        map[fields[i]] = fields[i + 1]
      end
      if map["state"] ~= "in-flight" or map["owner"] ~= ARGV[1] then return 0 end
      return redis.call("DEL", KEYS[1])
      `,
      1,
      this.key(key),
      owner,
    )) as number;
    return result === 1;
  }

  async extend(key: string, owner: string, lockTtl: number): Promise<boolean> {
    const result = (await this.redis.eval(
      `
      local fields = redis.call("HGETALL", KEYS[1])
      if #fields == 0 then return 0 end
      local map = {}
      for i = 1, #fields, 2 do
        map[fields[i]] = fields[i + 1]
      end
      if map["state"] ~= "in-flight" or map["owner"] ~= ARGV[1] then return 0 end
      redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[2]))
      return 1
      `,
      1,
      this.key(key),
      owner,
      String(lockTtl),
    )) as number;
    return result === 1;
  }
}
