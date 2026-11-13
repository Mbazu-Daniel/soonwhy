// fallow-ignore-file unused-class-member
// Members are consumed by the @nestjs/idempotency interceptor through the IdempotencyStore contract, which fallow cannot see.
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  IdempotencyStorage,
  type IdempotencyAcquireResult,
  type IdempotencyStore,
  type IdempotencyStoredPayload,
} from "@nestjs/idempotency";
import { and, eq, gt, lte } from "drizzle-orm";
import { db } from "../db";
import { idempotencyKeys } from "../db/schema";

const { keyHash, owner: ownerColumn, expiresAt } = idempotencyKeys;

@Injectable()
export class DrizzleIdempotencyStore implements IdempotencyStore {
  constructor(
    storage: IdempotencyStorage,
  ) {
    storage.registerSource(this);
  }

  async acquire(
    key: string,
    owner: string,
    fingerprint: string,
    lockTtl: number,
  ): Promise<IdempotencyAcquireResult> {
    const hash = hashOf(key);
    // A second round only happens when the row was released or expired
    // between the two statements below.
    for (let attempt = 0; attempt < 5; attempt++) {
      const now = Date.now();
      const lock = { fingerprint, owner, response: null, expiresAt: now + lockTtl };
      // Insert the lock, or take over an expired row. Of many concurrent
      // callers, PostgreSQL lets one write, and re-checks `setWhere` for the
      // others against the winner's row: they get no row back.
      const taken = await db
        .insert(idempotencyKeys)
        .values({ keyHash: hash, key, ...lock })
        .onConflictDoUpdate({
          target: keyHash,
          set: lock,
          setWhere: lte(expiresAt, now),
        })
        .returning({ keyHash });
      if (taken.length) {
        return { state: "acquired" };
      }

      const [row] = await db
        .select()
        .from(idempotencyKeys)
        .where(eq(keyHash, hash));
      if (row && row.expiresAt > now) {
        return row.response === null
          ? { state: "in-flight", fingerprint: row.fingerprint }
          : { state: "completed", fingerprint: row.fingerprint, response: row.response };
      }
    }
    throw new Error(`The idempotency record for "${key}" kept changing; try again`);
  }

  async complete(
    key: string,
    owner: string,
    response: IdempotencyStoredPayload,
    ttl: number,
  ): Promise<boolean> {
    const now = Date.now();
    const done = await db
      .update(idempotencyKeys)
      .set({ owner: null, response, expiresAt: now + ttl })
      .where(ownedBy(key, owner, now))
      .returning({ keyHash });
    return done.length === 1;
  }

  async release(key: string, owner: string): Promise<boolean> {
    const released = await db
      .delete(idempotencyKeys)
      .where(ownedBy(key, owner, Date.now()))
      .returning({ keyHash });
    return released.length === 1;
  }

  async extend(key: string, owner: string, lockTtl: number): Promise<boolean> {
    const now = Date.now();
    const extended = await db
      .update(idempotencyKeys)
      .set({ expiresAt: now + lockTtl })
      .where(ownedBy(key, owner, now))
      .returning({ keyHash });
    return extended.length === 1;
  }
}

function ownedBy(key: string, owner: string, now: number) {
  return and(eq(keyHash, hashOf(key)), eq(ownerColumn, owner), gt(expiresAt, now));
}

function hashOf(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
