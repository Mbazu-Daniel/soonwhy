import { afterAll, describe, expect, it } from "vitest";
import { CronLeaseService } from "../../src/common/cron/cron-lease.service";
import { closeDatabase, databaseTestsEnabled } from "../support/test-database";

describe.skipIf(!databaseTestsEnabled)("CronLeaseService database lock", () => {
  afterAll(closeDatabase);

  it("lets only one of two overlapping runs do the work", async () => {
    const lease = new CronLeaseService(undefined);
    let running = 0;
    let peak = 0;
    const job = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 300));
      running -= 1;
    };

    const results = await Promise.all([lease.runExclusive("it-job", 60_000, job), lease.runExclusive("it-job", 60_000, job)]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(peak).toBe(1);
  });

  it("releases the lock when the job ends so the next run can start", async () => {
    const lease = new CronLeaseService(undefined);
    await expect(lease.runExclusive("it-again", 60_000, async () => undefined)).resolves.toBe(true);
    await expect(lease.runExclusive("it-again", 60_000, async () => undefined)).resolves.toBe(true);
  });
});
