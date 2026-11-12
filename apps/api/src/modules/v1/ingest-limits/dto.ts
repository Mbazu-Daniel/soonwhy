import { z } from "zod";

export const ingestLimitBodySchema = z.object({
  maxEventsPerSecond: z.number().optional(),
  maxBytesPerSecond: z.number().optional(),
  backpressureEnabled: z.boolean().optional(),
  backpressureStrategy: z.string().optional(),
  sampleRate: z.number().optional(),
  traceSampleRate: z.number().optional(),
  metricSampleRate: z.number().optional(),
  logSampleRate: z.number().optional(),
  serviceSamplingConfig: z.record(z.unknown()).optional(),
  alertOnLimitExceeded: z.boolean().optional(),
});

export type IngestLimitBody = z.infer<typeof ingestLimitBodySchema>;

const signalTypeSchema = z.enum(["trace", "metric", "log"]);

export const ingestLimitCheckQuerySchema = z.object({
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  currentEventsPerSecond: z.coerce.number().optional(),
  signalType: signalTypeSchema.optional(),
  serviceName: z.string().optional(),
});

export type IngestLimitCheckQuery = z.infer<typeof ingestLimitCheckQuerySchema>;
