import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Inject, Injectable } from "@nestjs/common";
import { hosts } from "../db/schema";
import type { Db } from "../db";
import { DB } from "../db";
import type { ValidatedApiKey } from "./api-keys.types";
import { HostMetricsTarget } from "./host-metrics-target";

const CACHE_TTL_MS = 30_000;
const LAST_SEEN_EVERY_MS = 60_000;
const MAX_HOST_NAME_LENGTH = 255;

interface Cached {
  target: ValidatedApiKey | undefined;
  validUntil: number;
}

export function normalizeHostName(value: string | undefined): string {
  return (value ?? "").trim().slice(0, MAX_HOST_NAME_LENGTH);
}

@Injectable()
export class HostRegistry {
  private readonly cache = new Map<string, Cached>();
  private readonly lastSeenWritten = new Map<string, number>();

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly fallback: HostMetricsTarget,
  ) {}

  async resolve(hostName: string | undefined, now = Date.now()): Promise<ValidatedApiKey | undefined> {
    const name = normalizeHostName(hostName);
    if (!name) return this.fallback.resolve(now);
    const cached = this.cache.get(name);
    if (cached && cached.validUntil > now) return cached.target;
    const target = await this.lookup(name, now);
    this.cache.set(name, { target, validUntil: now + CACHE_TTL_MS });
    return target;
  }

  private async lookup(name: string, now: number): Promise<ValidatedApiKey | undefined> {
    const known = await this.find(name);
    if (known) {
      await this.touch(name, now);
      return this.fallback.projectTarget(known.projectId);
    }
    const initial = await this.fallback.resolve(now);
    if (!initial) return undefined;
    await this.db
      .insert(hosts)
      .values({
        id: randomUUID(),
        hostName: name,
        organizationId: initial.organizationId,
        projectId: initial.projectId,
      })
      .onConflictDoNothing({ target: hosts.hostName });
    const winner = await this.find(name);
    this.lastSeenWritten.set(name, now);
    return winner && winner.projectId !== initial.projectId
      ? this.fallback.projectTarget(winner.projectId)
      : initial;
  }

  private async find(name: string): Promise<{ projectId: string } | undefined> {
    const [row] = await this.db
      .select({ projectId: hosts.projectId })
      .from(hosts)
      .where(eq(hosts.hostName, name));
    return row;
  }

  private async touch(name: string, now: number): Promise<void> {
    const last = this.lastSeenWritten.get(name) ?? 0;
    if (now - last < LAST_SEEN_EVERY_MS) return;
    this.lastSeenWritten.set(name, now);
    try {
      await this.db.update(hosts).set({ lastSeenAt: new Date(now) }).where(eq(hosts.hostName, name));
    } catch {
      this.lastSeenWritten.delete(name);
    }
  }
}
