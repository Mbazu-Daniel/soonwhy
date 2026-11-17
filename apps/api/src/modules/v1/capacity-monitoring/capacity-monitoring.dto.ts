import { z } from "zod";

const percent = z.number().int().min(0).max(100);
const count = z.number().int().min(0);

export const RecordCapacityMetricDto = z.object({
  serviceName: z.string().trim().min(1).max(200),
  cpuPercent: percent.optional(),
  memoryPercent: percent.optional(),
  memoryUsedMB: count.optional(),
  memoryTotalMB: count.optional(),
  eventLoopLagMs: count.optional(),
  activeRequests: count.optional(),
  maxConcurrency: count.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RecordCapacityMetricInput = z.output<typeof RecordCapacityMetricDto>;
