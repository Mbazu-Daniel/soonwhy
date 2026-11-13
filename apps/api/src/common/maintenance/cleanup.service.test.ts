import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  db: { delete: vi.fn() },
}));

import { db } from "../db";
import { deadLetterQueue } from "../db/schema";
import { CleanupService, cutoff } from "./cleanup.service";

function rows(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: index }));
}

describe("CleanupService", () => {
  it("reports the number of rows removed from each table", async () => {
    vi.mocked(db.delete).mockImplementation(
      () =>
        ({
          where: () => ({ returning: async () => rows(2) }),
        }) as never,
    );
    const service = new CleanupService();

    const report = await service.cleanup(new Date("2026-11-05T03:00:00.000Z"));

    expect(report.results.map((result) => result.deleted)).toEqual([2, 2, 2, 2, 2]);
    expect(report.deletedTotal).toBe(10);
    expect(db.delete).toHaveBeenCalledTimes(5);
  });

  it("keeps cleaning other tables when one delete fails", async () => {
    vi.mocked(db.delete).mockImplementation(
      ((table: unknown) => {
        if (table === deadLetterQueue) throw new Error("lock timeout");
        return {
          where: () => ({ returning: async () => rows(1) }),
        };
      }) as never,
    );
    const service = new CleanupService();

    const report = await service.cleanup(new Date("2026-11-05T03:00:00.000Z"));

    expect(report.results.find((result) => result.table === "dead_letter_queue")).toMatchObject({
      deleted: 0,
      error: "lock timeout",
    });
    expect(report.deletedTotal).toBe(4);
  });

  it("derives the cutoff from the retention window", () => {
    const now = new Date("2026-11-05T00:00:00.000Z");

    expect(cutoff(now, 7).toISOString()).toBe("2026-10-29T00:00:00.000Z");
    expect(cutoff(now, 30).toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });
});
