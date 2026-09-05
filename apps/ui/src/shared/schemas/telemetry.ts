import { z } from 'zod';

export const TelemetryEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number().int().positive(),
  type: z.enum(['log', 'metric', 'error', 'request', 'trace']),
  projectId: z.string().min(1),
  service: z.string().optional(),
  data: z.record(z.unknown()),
});
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

export const LogDataSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  message: z.string().default(''),
  attributes: z.record(z.unknown()).optional(),
  stackTrace: z.string().optional(),
});

export const MetricDataSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  unit: z.enum(['ms', 'count', 'bytes', 'percent']).default('count'),
});

export const ErrorDataSchema = z.object({
  errorType: z.string().default('Error'),
  errorMessage: z.string().default(''),
  stack: z.string().optional(),
  fingerprint: z.string().optional(),
});

export const RequestDataSchema = z.object({
  method: z.string().default(''),
  url: z.string().default(''),
  statusCode: z.number().int().min(0).max(999).default(0),
  duration: z.number().min(0).default(0),
  userAgent: z.string().optional(),
  ip: z.string().optional(),
});

export const TraceDataSchema = z.object({
  traceId: z.string().min(1),
  spanId: z.string().min(1),
  parentSpanId: z.string().optional(),
  name: z.string().default(''),
  duration: z.number().min(0).default(0),
});

export const IngestBatchSchema = z.object({
  batch: z.array(TelemetryEventSchema).min(1).max(1000),
});
export type IngestBatch = z.infer<typeof IngestBatchSchema>;

const eventSchemas = {
  log: TelemetryEventSchema.extend({ type: z.literal('log'), data: LogDataSchema }),
  metric: TelemetryEventSchema.extend({ type: z.literal('metric'), data: MetricDataSchema }),
  error: TelemetryEventSchema.extend({ type: z.literal('error'), data: ErrorDataSchema }),
  request: TelemetryEventSchema.extend({ type: z.literal('request'), data: RequestDataSchema }),
  trace: TelemetryEventSchema.extend({ type: z.literal('trace'), data: TraceDataSchema }),
} as const;

export function validateEvent(event: TelemetryEvent) {
  const schema = eventSchemas[event.type];
  if (!schema) return { success: false as const, error: `Unknown event type: ${event.type}` };
  return schema.safeParse(event);
}
