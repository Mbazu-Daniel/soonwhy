import type { CaptureSettings } from "@soonwhy/shared";

export type IngestSignal = "trace" | "log" | "metric";

export type IngestItem = Record<string, unknown>;

export type IngestBatch = {
  version: 1;
  signal: IngestSignal;
  projectId: string;
  organizationId: string;
  captureSettings?: CaptureSettings;
  items: IngestItem[];
};

export type IngestPayload = IngestItem & {
  projectId: string;
  organizationId: string;
  captureSettings?: CaptureSettings;
  items?: IngestItem[];
  version?: number;
  signal?: string;
};
