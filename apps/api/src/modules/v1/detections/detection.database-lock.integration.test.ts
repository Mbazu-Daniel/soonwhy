import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../../common/db";
import type { QuickwitService } from "@soonwhy/shared";
import type { ProjectsRepository } from "../projects/projects.repository";
import { DetectionService } from "./detection.service";

vi.mock("../../../common/db", () => ({
  db: { insert: vi.fn(), update: vi.fn() },
}));

describe("DetectionService database lock contention", () => {
  const search = vi.fn();
  const getProjectById = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getProjectById.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    search.mockResolvedValue({ hits: [] });

    let sequence = 0;
    vi.mocked(db.insert).mockImplementation(
      () =>
        ({
          values: vi
            .fn()
            .mockImplementation(
              (input: { type: string; evidence?: unknown[] }) => ({
                returning: vi.fn().mockResolvedValue([
                  {
                    id: "finding-" + ++sequence,
                    projectId: "project-1",
                    serviceName: "checkout-api",
                    type: input.type,
                    severity: "warning",
                    title: input.type,
                    description: input.type,
                    observedValue: 40,
                    threshold: 10,
                    unit: "% lock error rate",
                    windowStart: new Date("2026-09-20T18:00:00.000Z"),
                    windowEnd: new Date("2026-09-20T18:15:00.000Z"),
                    evidence: input.evidence ?? [],
                  },
                ]),
              }),
            ),
        }) as never,
    );

    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi
                .fn()
                .mockResolvedValue([{ id: "run-1", status: "completed" }]),
            }),
          }),
        }) as never,
    );
  });

  it("persists lock contention with error and query evidence", async () => {
    let databaseCalls = 0;
    search.mockImplementation(
      async (_index: string, input: { query?: string }) => {
        const query = String(input?.query ?? "");
        if (query.includes("dependencyType") && query.includes("database")) {
          databaseCalls += 1;
          if (databaseCalls > 1) return { hits: [] };

          return {
            hits: [
              {
                _source: {
                  timestamp: "2026-09-20T18:01:00.000Z",
                  service: "checkout-api",
                  traceId: "trace-lock-1",
                  spanId: "span-lock-1",
                  name: "UPDATE orders",
                  duration: 420,
                  dependencyType: "database",
                  dependencyName: "postgres",
                  dbQueryText: "update orders set status = ? where id = ?",
                  dbSystemName: "postgresql",
                  statusMessage: "deadlock detected",
                  errorType: "40P01",
                },
              },
              {
                _source: {
                  timestamp: "2026-09-20T18:02:00.000Z",
                  service: "checkout-api",
                  traceId: "trace-lock-2",
                  spanId: "span-lock-2",
                  name: "UPDATE orders",
                  duration: 380,
                  dependencyType: "database",
                  dependencyName: "postgres",
                  dbQueryText: "update orders set status = ? where id = ?",
                  dbSystemName: "postgresql",
                  statusMessage: "deadlock detected",
                },
              },
              {
                _source: {
                  timestamp: "2026-09-20T18:03:00.000Z",
                  service: "checkout-api",
                  traceId: "trace-lock-3",
                  spanId: "span-lock-3",
                  name: "UPDATE orders",
                  duration: 30,
                  dependencyType: "database",
                  dependencyName: "postgres",
                  dbQueryText: "update orders set status = ? where id = ?",
                  dbSystemName: "postgresql",
                },
              },
            ],
          };
        }

        return { hits: [] };
      },
    );

    const service = new DetectionService(
      { search } as unknown as QuickwitService,
      { getProjectById } as unknown as ProjectsRepository,
      { apply: vi.fn().mockResolvedValue({ action: "created" }) } as never,
    );

    const result = await service.run("org-1", "project-1");
    const finding = result.find(
      (item) => item.type === "database_lock_contention",
    );

    expect(finding).toBeDefined();
    expect(finding?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "database-lock-sample" }),
        expect.objectContaining({ label: "database-lock-profile" }),
        expect.objectContaining({ label: "database-lock-guidance" }),
      ]),
    );
    expect(
      finding?.evidence.find((item) => item.label === "database-lock-profile")
        ?.context,
    ).toMatchObject({
      lockErrorCount: 2,
      contentionSignals: "lock_error",
      confidence: "high",
      databaseSystem: "postgresql",
    });
    expect(
      finding?.evidence.find((item) => item.label === "database-lock-sample")
        ?.context,
    ).toMatchObject({
      traceId: "trace-lock-1",
      statusMessage: "deadlock detected",
    });
  });
});
