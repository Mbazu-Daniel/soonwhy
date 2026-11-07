import { z } from "zod";

export const ClientEventDto = z.object({
  // Event type: error, pageview, click, custom, etc.
  type: z.string().min(1).max(50),
  // Optional message/description
  message: z.string().optional(),
  // Optional severity: low, medium, high, critical
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  // Optional stack trace for errors
  stack: z.string().optional(),
  // Optional URL where the event occurred
  url: z.string().url().optional(),
  // Optional user agent
  userAgent: z.string().optional(),
  // Optional user ID
  userId: z.string().optional(),
  // Optional session ID
  sessionId: z.string().optional(),
  // Optional trace ID for correlation
  traceId: z.string().optional(),
  // Optional span ID for correlation
  spanId: z.string().optional(),
  // Custom attributes as key-value pairs
  attributes: z.record(z.string(), z.unknown()).optional(),
  // Optional timestamp override
  timestamp: z.string().datetime().optional(),
});

export type ClientEventInput = z.infer<typeof ClientEventDto>;

export const ClientEventsBatchDto = z.object({
  events: z.array(ClientEventDto).min(1).max(100),
});

export type ClientEventsBatchInput = z.infer<typeof ClientEventsBatchDto>;
