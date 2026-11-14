import type { CaptureSettings } from "@soonwhy/shared";

export interface BatchIdentity {
  signal: string;
  organizationId: string;
  projectId: string;
  captureSettings: CaptureSettings;
}
