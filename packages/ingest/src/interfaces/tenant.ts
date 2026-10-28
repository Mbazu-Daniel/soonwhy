import type { CaptureSettings } from "@soonwhy/shared";

export interface OrganizationContext {
  projectId: string;
  organizationId: string;
  captureSettings: CaptureSettings;
}
