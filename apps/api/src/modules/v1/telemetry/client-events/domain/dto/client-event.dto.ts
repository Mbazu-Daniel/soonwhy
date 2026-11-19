import { z } from "zod";

const ClientEventDto = z.object({
  type: z.string().min(1).max(50),
  message: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  stack: z.string().optional(),
  url: z.string().url().optional(),
  userAgent: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

export type ClientEventInput = z.infer<typeof ClientEventDto>;

export const ClientEventsBatchDto = z.object({
  events: z.array(ClientEventDto).min(1).max(100),
});

export type ClientEventsBatchInput = z.infer<typeof ClientEventsBatchDto>;
