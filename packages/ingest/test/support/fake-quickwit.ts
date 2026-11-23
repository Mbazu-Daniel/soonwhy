import { QUICKWIT_WRITE_STATE, QuickwitIngestError } from "@soonwhy/shared";

export type IngestPlan = "ok" | "timeout-after-append" | "crash-before-append" | "crash-after-append" | "refuse" | { reject: number[] };

type StoredDocument = { document: Record<string, unknown>; visibleAt: number };

export class VirtualClock {
  now = 0;

  advance(ms: number): void {
    this.now += ms;
  }
}

export class FakeQuickwit {
  readonly documents: StoredDocument[] = [];
  readonly plans: IngestPlan[] = [];
  ingestCalls = 0;
  lookupCalls = 0;
  lookupFails = false;
  holdVisibility = false;
  ingestDelayMs = 0;

  constructor(
    private readonly clock: VirtualClock,
    readonly commitDelayMs: number,
    private readonly configuredCommitTimeoutSecs = 60,
  ) {}

  ensureIndex = async () => undefined;

  commitTimeoutSecs = async () => this.configuredCommitTimeoutSecs;

  async ingest(_indexId: string, documents: Array<Record<string, unknown>>) {
    this.ingestCalls += 1;
    if (this.ingestDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.ingestDelayMs));
    const plan = this.plans.shift() ?? "ok";
    if (plan === "refuse") throw new QuickwitIngestError("ECONNREFUSED", QUICKWIT_WRITE_STATE.notWritten);
    if (plan === "crash-before-append") throw new Error("process crashed before the append");

    const rejectedIndexes = typeof plan === "object" ? plan.reject : [];
    const accepted = documents.filter((_, index) => !rejectedIndexes.includes(index));
    for (const document of accepted) this.documents.push({ document, visibleAt: this.clock.now + this.commitDelayMs });

    if (plan === "timeout-after-append") throw new QuickwitIngestError("timed out", QUICKWIT_WRITE_STATE.unknown);
    if (plan === "crash-after-append") throw new Error("process crashed after the append");
    return {
      received: documents.length,
      ingested: accepted.length,
      rejected: rejectedIndexes.map((index) => ({
        document: JSON.stringify(documents[index]),
        reason: "invalid_schema",
        message: "field `timestamp` is required",
      })),
    };
  }

  async findEventIds(_indexId: string, eventIds: string[]) {
    this.lookupCalls += 1;
    if (this.lookupFails) throw new Error("search is unavailable");
    const visible = new Set(this.documents.filter((stored) => !this.holdVisibility && stored.visibleAt <= this.clock.now).map((stored) => stored.document.eventId as string));
    return new Set(eventIds.filter((id) => visible.has(id)));
  }

  countsByEventId(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const { document } of this.documents) {
      const id = document.eventId as string;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }
}
