import { z } from 'zod';
import { IngestBatchSchema } from '@soonwhy/shared';

export const IngestBodySchema = IngestBatchSchema;

export type IngestBody = z.infer<typeof IngestBodySchema>;

export interface IngestResponse {
  accepted: number;
  rejected: number;
  errors?: string[];
}
