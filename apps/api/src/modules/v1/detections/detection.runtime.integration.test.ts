import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../../common/db";
import type { QuickwitService } from "@soonwhy/shared";
import type { ProjectsRepository } from "../projects/projects.repository";
import { DetectionService } from "./detection.service";

vi.mock("../../../common/db", () => ({
  db: { insert: vi.fn(), update: vi.fn() },
}));

describe("DetectionService runtime intelligence", () => {
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
                    severity: "critical",
                    title: input.type,
                    description: input.type,
                    observedValue: 0.97,
                    threshold: 0.95,
                    unit: "ratio",
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

  it("persists runtime saturation with metric evidence and identity", async () => {
    let metricsCalls = 0;
    search.mockImplementation(
      async (index: string, input: { query?: string }) => {
        if (
          index === "telemetry-metrics" &&
          String(input?.query ?? "").includes("process.cpu.utilization")
        ) {
          metricsCalls += 1;
          const values =
            metricsCalls === 1
              ? [0.88, 0.91, 0.96, 0.99, 0.97, 0.95]
              : [0.4, 0.42, 0.45, 0.41, 0.43, 0.44];

          return {
            hits: values.map((value, sample) => ({
              _source: {
                timestamp: `2026-09-20T18:0${sample}:00.000Z`,
                service: "checkout-api",
                name: "process.cpu.utilization",
                value,
              },
            })),
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
    const finding = result.find((item) => item.type === "runtime_degradation");

    expect(finding).toMatchObject({
      serviceName: "checkout-api",
      severity: "critical",
      observedValue: 0.97,
      threshold: 0.95,
      unit: "ratio",
    });
    expect(finding?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "runtime-metric" }),
        expect.objectContaining({ label: "runtime-profile" }),
        expect.objectContaining({ label: "runtime-guidance" }),
      ]),
    );
    expect(
      finding?.evidence.find((item) => item.label === "runtime-profile")
        ?.context,
    ).toMatchObject({
      metricName: "process.cpu.utilization",
      runtimeFamily: "cpu",
      baselineP95: expect.any(Number),
      fingerprintVersion: 1,
    });
  });
});
